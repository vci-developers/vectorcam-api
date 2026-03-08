import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../../config/environment';
import { SpecimenImage, Specimen, TusUploadLog } from '../../../db/models';
import { findSpecimenImage } from '../common';
import { createHash } from 'crypto';
import { Op, literal } from 'sequelize';
import { getFileStream } from '../../../services/s3.service';
import { TusUploadPartRecord } from '../../../db/models/TusUploadLog';
import sequelize from '../../../db';

let tusServer: any;

interface TusUploadMetadata {
  contentType?: string;
  fileType?: string;
  filemd5?: string;
  imageId?: string;
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

function extractSpecimenId(url: string): number | null {
  const match = url.match(/\/specimens\/(.+?)\/images\/tus/);
  if (!match?.[1]) {
    return null;
  }

  const specimenId = Number(match[1]);
  return Number.isFinite(specimenId) ? specimenId : null;
}

function extractTusUploadId(url: string): string | null {
  const match = url.match(/\/images\/tus\/([^/?]+)/);
  return match?.[1] || null;
}

function getRequestHeader(req: any, headerName: string): string | undefined {
  const normalizedName = headerName.toLowerCase();

  const headers = req?.headers;
  if (headers) {
    // Fetch Headers style
    if (typeof headers.get === 'function') {
      const fromHeadersGet = headers.get(headerName) || headers.get(normalizedName);
      if (fromHeadersGet) {
        return fromHeadersGet;
      }
    }

    // Node IncomingHttpHeaders style
    const rawValue =
      headers[normalizedName] ??
      headers[headerName] ??
      headers[headerName.toUpperCase()];
    if (Array.isArray(rawValue)) {
      return rawValue[0];
    }
    if (typeof rawValue === 'string') {
      return rawValue;
    }
    if (typeof rawValue === 'number') {
      return String(rawValue);
    }
  }

  if (typeof req?.header === 'function') {
    const fromHeaderFn = req.header(headerName) || req.header(normalizedName);
    if (fromHeaderFn) {
      return fromHeaderFn;
    }
  }

  if (typeof req?.getHeader === 'function') {
    const fromGetHeaderFn = req.getHeader(headerName) || req.getHeader(normalizedName);
    if (Array.isArray(fromGetHeaderFn)) {
      return fromGetHeaderFn[0];
    }
    if (typeof fromGetHeaderFn === 'string') {
      return fromGetHeaderFn;
    }
    if (typeof fromGetHeaderFn === 'number') {
      return String(fromGetHeaderFn);
    }
  }

  return undefined;
}

function parseHeaderNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function updateTusUploadFailure(
  specimenId: number,
  tusUploadId: string,
  reason: string
): Promise<void> {
  await TusUploadLog.update(
    {
      status: 'failed',
      failureReason: reason,
      uploadFinishedAt: new Date(),
    },
    {
      where: {
        specimenId,
        tusUploadId,
      },
    }
  );
}

async function recordTusPartUpload(req: any): Promise<void> {
  if (req.method !== 'PATCH') {
    return;
  }

  const specimenId = extractSpecimenId(req.url);
  const tusUploadId = extractTusUploadId(req.url);

  if (!specimenId || !tusUploadId) {
    return;
  }

  const now = new Date();
  const contentLength = parseHeaderNumber(getRequestHeader(req, 'content-length'));
  const uploadOffset = parseHeaderNumber(getRequestHeader(req, 'upload-offset'));
  const partTimestamp = now.toISOString();
  const escapedTimestamp = sequelize.escape(partTimestamp);
  const escapedNow = sequelize.escape(now);
  const partSizeSql = contentLength === null ? 'NULL' : String(contentLength);
  const uploadOffsetSql = uploadOffset === null ? 'NULL' : String(uploadOffset);

  const [updatedRows] = await TusUploadLog.update(
    {
      status: literal("CASE WHEN status = 'created' THEN 'in_progress' ELSE status END"),
      uploadStartedAt: literal(`COALESCE(upload_started_at, ${escapedNow})`),
      parts: literal(
        `JSON_ARRAY_APPEND(
          COALESCE(parts, JSON_ARRAY()),
          '$',
          JSON_OBJECT(
            'partNumber', JSON_LENGTH(COALESCE(parts, JSON_ARRAY())) + 1,
            'partSize', ${partSizeSql},
            'uploadOffset', ${uploadOffsetSql},
            'uploadedAt', ${escapedTimestamp}
          )
        )`
      ),
    },
    {
      where: { specimenId, tusUploadId },
    }
  );

  if (updatedRows > 0) {
    return;
  }

  try {
    const firstPart: TusUploadPartRecord = {
      partNumber: 1,
      partSize: contentLength,
      uploadOffset,
      uploadedAt: partTimestamp,
    };
    await TusUploadLog.create({
      specimenId,
      tusUploadId,
      status: 'in_progress',
      uploadCreatedAt: now,
      uploadStartedAt: now,
      parts: [firstPart],
    });
  } catch (error: any) {
    // Another concurrent request may have created the row after our UPDATE.
    if (error?.name === 'SequelizeUniqueConstraintError') {
      await TusUploadLog.update(
        {
          status: literal("CASE WHEN status = 'created' THEN 'in_progress' ELSE status END"),
          uploadStartedAt: literal(`COALESCE(upload_started_at, ${escapedNow})`),
          parts: literal(
            `JSON_ARRAY_APPEND(
              COALESCE(parts, JSON_ARRAY()),
              '$',
              JSON_OBJECT(
                'partNumber', JSON_LENGTH(COALESCE(parts, JSON_ARRAY())) + 1,
                'partSize', ${partSizeSql},
                'uploadOffset', ${uploadOffsetSql},
                'uploadedAt', ${escapedTimestamp}
              )
            )`
          ),
        },
        {
          where: { specimenId, tusUploadId },
        }
      );
      return;
    }
    throw error;
  }
}

// Helper to check for MD5 collision for a specimen, optionally excluding an imageId
async function checkMd5Collision(specimenId: number, filemd5: string, excludeImageId?: number) {
  const where: any = { specimenId, filemd5 };
  if (excludeImageId) {
    where.id = { [Op.ne]: excludeImageId };
  }
  return await SpecimenImage.findOne({ where });
}

async function getTusServer(): Promise<any> {
  if (!tusServer) {
    const { Server: TusServer } = await import('@tus/server');
    const { S3Store } = await import('@tus/s3-store');
    const s3Store = new S3Store({
      partSize: 5 * 1024 * 1024, // 5MB
      s3ClientConfig: {
        bucket: config.aws.s3BucketName || '',
        region: config.aws.region || '',
        credentials: {
          accessKeyId: config.aws.accessKeyId || '',
          secretAccessKey: config.aws.secretAccessKey || '',
        },
      },
    });
    tusServer = new TusServer({
      path: '/specimens/:specimen_id/images/tus',
      datastore: s3Store,
      generateUrl: (req, upload) => {
        return `${req.url}/${upload.id}`;
      },
      onIncomingRequest: (async (req) => {
        void recordTusPartUpload(req).catch((error) => {
          console.error('Error tracking tus part upload:', error);
        });
      }),
      onUploadCreate: (async (req, upload) => {
        const contentType = upload.metadata?.contentType || upload.metadata?.fileType || "";
        const filemd5 = upload.metadata?.filemd5;
        const imageId = upload.metadata?.imageId;
        const specimenId = extractSpecimenId(req.url);

        if (!specimenId) {
          const err: any = new Error('Specimen ID missing in URL.');
          err.status_code = 400;
          throw err;
        }

        const specimen = await Specimen.findByPk(specimenId);
        if (!specimen) {
          const err: any = new Error('Specimen not found.');
          err.status_code = 404;
          throw err;
        }
        let excludeImageId: number | undefined = undefined;
        if (imageId) {
          // Validate imageId belongs to this specimen (id or filemd5)
          const image = await findSpecimenImage(specimen.id, imageId);
          if (!image) {
            const err: any = new Error('Invalid imageId: not found or does not belong to this specimen.');
            err.status_code = 404;
            throw err;
          }
          excludeImageId = image.id;
        }
        if (filemd5) {
          const collision = await checkMd5Collision(specimen.id, filemd5, excludeImageId);
          if (collision) {
            const err: any = new Error('Duplicate image: file with this MD5 already exists for this specimen.');
            err.status_code = 409;
            throw err;
          }
        }

        const uploadPayload = upload as TusUploadPayload;
        const uploadLength = typeof uploadPayload.size === 'number' ? uploadPayload.size : null;
        await TusUploadLog.upsert({
          specimenId: specimen.id,
          tusUploadId: uploadPayload.id,
          status: 'created',
          requestedImageRef: imageId || null,
          uploadLength,
          uploadCreatedAt: new Date(),
          metadata: upload.metadata || null,
          parts: [],
        });

        return { metadata: { ...upload.metadata, contentType } }
      }),
      onUploadFinish: (async function(req, upload) {
        try {
          const specimenId = extractSpecimenId(req.url);
          if (!specimenId) return {};

          const uploadPayload = upload as TusUploadPayload;
          const tusUploadId = uploadPayload.id;
          const specimen: Specimen | null = await Specimen.findByPk(specimenId);
          if (!specimen) return {};

          // S3 key is in upload.storage.key
          const imageKey: string | undefined = uploadPayload.storage?.path;
          if (!imageKey) {
            await updateTusUploadFailure(specimen.id, tusUploadId, 'Missing uploaded S3 key path.');
            return {};
          }
          
          // Calculate MD5 hash of the uploaded file
          const { stream } = await getFileStream(imageKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);
          const filemd5 = createHash('md5').update(fileBuffer).digest('hex');

          const imageId = upload.metadata?.imageId;
          // Check MD5 if provided in metadata
          const expectedMd5 = upload.metadata?.filemd5;
          if (expectedMd5 && expectedMd5 !== filemd5) {
            await updateTusUploadFailure(specimen.id, tusUploadId, 'MD5 mismatch: file corrupted during upload.');
            return {
              status_code: 400,
              body: JSON.stringify({ message: 'MD5 mismatch: file corrupted during upload.' })
            };
          }

          if (imageId) {
            // Replace existing image (id or filemd5)
            const image = await findSpecimenImage(specimen.id, imageId);
            if (!image) {
              await updateTusUploadFailure(specimen.id, tusUploadId, 'Invalid imageId: not found or does not belong to this specimen.');
              return {
                status_code: 400,
                body: JSON.stringify({ message: 'Invalid imageId: not found or does not belong to this specimen.' })
              };
            }
            // Check for MD5 collision with other images for this specimen
            const collision = await checkMd5Collision(specimen.id, filemd5, image.id);
            if (collision) {
              await updateTusUploadFailure(specimen.id, tusUploadId, 'Duplicate image: file with this MD5 already exists for this specimen.');
              return {
                status_code: 409,
                body: JSON.stringify({ message: 'Duplicate image: file with this MD5 already exists for this specimen.' })
              };
            }
            // Update the image record
            await image.update({ imageKey, filemd5 });
            await specimen.update({ thumbnailImageId: image.id });
            await TusUploadLog.update(
              {
                status: 'completed',
                imageId: image.id,
                s3Path: imageKey,
                failureReason: null,
                uploadFinishedAt: new Date(),
              },
              {
                where: {
                  specimenId: specimen.id,
                  tusUploadId,
                },
              }
            );

            return {
              status_code: 204,
              body: JSON.stringify({
                imageId: image.id,
                imageUrl: `/specimens/${specimen.id}/images/${image.id}`
              })
            };
          } else {
            // Check for MD5 collision in DB after upload
            const collision = await checkMd5Collision(specimen.id, filemd5);
            if (collision) {
              await updateTusUploadFailure(specimen.id, tusUploadId, 'Duplicate image: file with this MD5 already exists for this specimen.');
              return {
                status_code: 409,
                body: JSON.stringify({ message: 'Duplicate image: file with this MD5 already exists for this specimen.' })
              };
            }
            // Create SpecimenImage record with MD5
            const newImage = await SpecimenImage.create({
              specimenId: specimen.id,
              imageKey,
              filemd5
            });
            // Update specimen to use this as the thumbnail
            await specimen.update({ thumbnailImageId: newImage.id });
            await TusUploadLog.update(
              {
                status: 'completed',
                imageId: newImage.id,
                s3Path: imageKey,
                failureReason: null,
                uploadFinishedAt: new Date(),
              },
              {
                where: {
                  specimenId: specimen.id,
                  tusUploadId,
                },
              }
            );
            return {
              status_code: 204,
              body: JSON.stringify({
                imageId: newImage.id,
                imageUrl: `/specimens/${specimen.id}/images/${newImage.id}`
              })
            };
          }
        } catch (err) {
          // Log but do not throw, to avoid breaking tus response
          console.error('Error in tus onUploadFinish:', err);
          const specimenId = extractSpecimenId(req.url);
          const uploadPayload = upload as TusUploadPayload;
          if (specimenId && uploadPayload.id) {
            await updateTusUploadFailure(specimenId, uploadPayload.id, `Error in tus onUploadFinish: ${String(err)}`);
          }
          return {
            status_code: 500,
            body: JSON.stringify({ message: `Error in tus onUploadFinish: ${err}` })
          };
        }
      })
    });
  }
  return tusServer;
}

// Fastify handler for all tus endpoints
export async function tusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const server = await getTusServer();
  return server.handle(request.raw, reply.raw);
} 