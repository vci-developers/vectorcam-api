import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../../config/environment';
import { findSpecimen } from '../common';
import { SpecimenImage, Specimen } from '../../../db/models';
import { createHash } from 'crypto';
import { getFileStream } from '../../../services/s3.service';

let tusServer: any;

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
      onUploadCreate: (async (_, upload) => {
        const contentType = upload.metadata?.contentType || upload.metadata?.fileType || "";
        console.log('contentType', contentType)
        return { metadata: { ...upload.metadata, contentType } }
      }),
      onUploadFinish: (async function(req, upload) {
        try {
          const match = req.url.match(/\/specimens\/(.+?)\/images\/tus/);
          const specimen_id = match ? match[1] : null;
          if (!specimen_id) return {};
          const specimen: Specimen | null = await findSpecimen(specimen_id);
          if (!specimen) return {};
          // S3 key is in upload.storage.key
          const imageKey: string | undefined = upload.storage?.path;
          if (!imageKey) return {};
          
          // Calculate MD5 hash of the uploaded file
          const { stream } = await getFileStream(imageKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);
          const filemd5 = createHash('md5').update(fileBuffer).digest('hex');
          
          // Create SpecimenImage record with MD5
          const newImage = await SpecimenImage.create({
            specimenId: specimen.id,
            imageKey,
            filemd5
          });
          // If there's no current thumbnail, set it
          if (!specimen.thumbnailImageId) {
            await specimen.update({ thumbnailImageId: newImage.id });
          }
          return {
            status_code: 204,
            body: JSON.stringify({
              imageId: newImage.id,
              imageUrl: `/specimens/${specimen.specimenId}/images/${newImage.id}`
            })
          };
        } catch (err) {
          // Log but do not throw, to avoid breaking tus response
          console.error('Error in tus onUploadFinish:', err);
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