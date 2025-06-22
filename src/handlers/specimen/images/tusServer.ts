import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../../config/environment';
import { findSpecimen } from '../common';
import { SpecimenImage, Specimen } from '../../../db/models';

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
      path: '/tus',
      datastore: s3Store,
      onUploadFinish: (async function(req: any, upload: any) {
        try {
          const match = req.url.match(/\/specimens\/(.+?)\/images\/tus/);
          const specimen_id = match ? match[1] : null;
          if (!specimen_id) return {};
          const specimen: Specimen | null = await findSpecimen(specimen_id);
          if (!specimen) return {};
          // S3 key is in upload.storage.key
          const imageKey: string | undefined = upload.storage && upload.storage.key;
          if (!imageKey) return {};
          // Create SpecimenImage record
          const newImage = await SpecimenImage.create({
            specimenId: specimen.id,
            imageKey
          });
          // If there's no current thumbnail, set it
          if (!specimen.thumbnailImageId) {
            await specimen.update({ thumbnailImageId: newImage.id });
          }
        } catch (err) {
          // Log but do not throw, to avoid breaking tus response
          console.error('Error in tus onUploadFinish:', err);
        }
        return {};
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
  // Set CORS headers for tus protocol
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'POST, GET, HEAD, PATCH, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Defer-Length, Upload-Concat, Upload-Offset, Content-Type, Authorization, Origin, X-Requested-With, Accept');
  const server = await getTusServer();
  // Pass the raw Node.js req/res to tus server
  // Note: tusServer.handle expects Node.js req/res, not Fastify's
  await server.handle(request.raw, reply.raw);
  // Fastify expects us to return, but tusServer will end the response
  reply.sent = true;
} 