import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/environment';
import { DataRecovery } from '../../db/models';
import { createHash } from 'crypto';
import {
  copyObjectInMainBucket,
  deleteFile,
  getDataRecoveryObjectPrefix,
  getFileStreamFromBucket,
  getMainS3Bucket,
} from '../../services/s3.service';
import { buildDataRecoveryObjectKey } from './s3ObjectKey';
import {
  finalizeDataRecoveryUpload,
  getUploadInfoFromPayload,
  isRecoveryUploadComplete,
  markUploadFailed,
  mergeDataRecoveryUploadPayload,
} from './uploadPayload';

let tusServer: unknown;

interface TusUploadMetadata {
  contentType?: string;
  fileType?: string;
  filemd5?: string;
  [key: string]: unknown;
}

interface TusUploadPayload {
  id: string;
  metadata?: TusUploadMetadata;
  size?: number;
  storage?: {
    path?: string;
  };
}

const FILEMD5_PATTERN = /^[a-f0-9]{32}$/;

function extractRecoveryId(url: string): number | null {
  const match = url.match(/\/data-recoveries\/(\d+)\/tus/);
  if (!match?.[1]) {
    return null;
  }
  const recoveryId = Number(match[1]);
  return Number.isFinite(recoveryId) ? recoveryId : null;
}

function tusError(message: string, statusCode: number): Error {
  const err = new Error(message) as Error & { status_code?: number };
  err.status_code = statusCode;
  return err;
}

function contentTypeFromMetadata(metadata?: TusUploadMetadata): string {
  return metadata?.contentType || metadata?.fileType || '';
}

async function getTusServer(): Promise<{ handle: (req: unknown, res: unknown) => Promise<void> }> {
  if (!tusServer) {
    const { Server: TusServer } = await import('@tus/server');
    const { S3Store } = await import('@tus/s3-store');
    const bucket = getMainS3Bucket();
    const s3Store = new S3Store({
      partSize: 5 * 1024 * 1024,
      s3ClientConfig: {
        bucket,
        region: config.aws.region || '',
        credentials: {
          accessKeyId: config.aws.accessKeyId || '',
          secretAccessKey: config.aws.secretAccessKey || '',
        },
      },
    });

    tusServer = new TusServer({
      path: '/data-recoveries/:id/tus',
      datastore: s3Store,
      generateUrl: (req: { url?: string }, upload: { id: string }) => {
        return `${req.url}/${upload.id}`;
      },
      onUploadCreate: async (req: { url?: string }, upload: TusUploadPayload) => {
        const recoveryId = extractRecoveryId(req.url || '');
        if (!recoveryId) {
          throw tusError('Data recovery ID missing in URL.', 400);
        }

        const record = await DataRecovery.findByPk(recoveryId);
        if (!record) {
          throw tusError('Data recovery record not found.', 404);
        }

        const filemd5 = upload.metadata?.filemd5?.toLowerCase();
        if (!filemd5 || !FILEMD5_PATTERN.test(filemd5)) {
          throw tusError('TUS metadata must include filemd5 (32-char hex).', 400);
        }

        const existingUpload = getUploadInfoFromPayload(record.payload);
        if (isRecoveryUploadComplete(record.payload, filemd5)) {
          throw tusError('Recovery file already uploaded for this filemd5.', 409);
        }
        if (existingUpload?.state === 'uploaded' && existingUpload.filemd5 && existingUpload.filemd5 !== filemd5) {
          throw tusError('Recovery record already has a different uploaded file.', 409);
        }

        const contentType = contentTypeFromMetadata(upload.metadata);
        const nextStatus = record.status === 'uploaded' ? record.status : 'pending_upload';
        await record.update({
          status: nextStatus,
          payload: mergeDataRecoveryUploadPayload(record.payload, {
            state: 'in_progress',
            filemd5,
            tusUploadId: upload.id,
            contentType: contentType || undefined,
          }),
        });

        return { metadata: { ...upload.metadata, filemd5, contentType } };
      },
      onUploadFinish: async (req: { url?: string }, upload: TusUploadPayload) => {
        const recoveryId = extractRecoveryId(req.url || '');
        if (!recoveryId) {
          return {};
        }

        const tusUploadId = upload.id;
        const record = await DataRecovery.findByPk(recoveryId);
        if (!record) {
          return {};
        }

        const tusObjectKey = upload.storage?.path;
        if (!tusObjectKey) {
          await record.update({
            payload: markUploadFailed(record.payload, 'Missing uploaded S3 key path.', { tusUploadId }),
          });
          return {};
        }

        const bucket = getMainS3Bucket();

        try {
          const expectedMd5 = upload.metadata?.filemd5?.toLowerCase();
          const { stream } = await getFileStreamFromBucket(bucket, tusObjectKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
          }
          const fileBuffer = Buffer.concat(chunks);
          const calculatedMd5 = createHash('md5').update(fileBuffer).digest('hex');

          if (expectedMd5 && expectedMd5 !== calculatedMd5) {
            await record.update({
              payload: markUploadFailed(record.payload, 'MD5 mismatch: file corrupted during upload.', {
                tusUploadId,
                filemd5: expectedMd5,
              }),
            });
            return {
              status_code: 400,
              body: JSON.stringify({ message: 'MD5 mismatch: file corrupted during upload.' }),
            };
          }

          const filemd5 = expectedMd5 || calculatedMd5;
          const contentType = contentTypeFromMetadata(upload.metadata);
          const canonicalKey = buildDataRecoveryObjectKey(
            getDataRecoveryObjectPrefix(),
            recoveryId,
            filemd5,
            contentType
          );

          if (isRecoveryUploadComplete(record.payload, filemd5)) {
            if (tusObjectKey !== canonicalKey) {
              try {
                await deleteFile(tusObjectKey);
              } catch (cleanupError) {
                console.error('Failed to delete redundant TUS object after idempotent finish:', cleanupError);
              }
            }
          } else if (tusObjectKey !== canonicalKey) {
            await copyObjectInMainBucket(tusObjectKey, canonicalKey);
            try {
              await deleteFile(tusObjectKey);
            } catch (cleanupError) {
              console.error('Failed to delete TUS staging object after copy:', cleanupError);
            }
          }

          const { nextPayload, nextStatus, duplicate } = finalizeDataRecoveryUpload({
            payload: record.payload,
            status: record.status,
            tusUploadId,
            s3Key: canonicalKey,
            s3Bucket: bucket,
            filemd5,
            contentType: contentType || undefined,
            bytes: typeof upload.size === 'number' ? upload.size : fileBuffer.length,
          });

          await record.update({
            status: nextStatus,
            payload: nextPayload,
          });

          return {
            status_code: 204,
            body: JSON.stringify({
              duplicate,
              dataRecoveryId: record.id,
              filemd5,
              s3Key: canonicalKey,
              s3Bucket: bucket,
            }),
          };
        } catch (err) {
          console.error('Error in data recovery tus onUploadFinish:', err);
          await record.update({
            payload: markUploadFailed(record.payload, `Error in tus onUploadFinish: ${String(err)}`, {
              tusUploadId,
            }),
          });
          return {
            status_code: 500,
            body: JSON.stringify({ message: `Error in tus onUploadFinish: ${err}` }),
          };
        }
      },
    });
  }
  return tusServer as { handle: (req: unknown, res: unknown) => Promise<void> };
}

export async function tusHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const server = await getTusServer();
  return server.handle(request.raw, reply.raw);
}
