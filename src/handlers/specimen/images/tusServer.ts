import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../../config/environment';
import { findSpecimen } from '../common';
import { SpecimenImage, Specimen } from '../../../db/models';
import { createHash } from 'crypto';
import { Op } from 'sequelize';
import { getFileStream } from '../../../services/s3.service';

let tusServer: any;

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
      onUploadCreate: (async (req, upload) => {
        const contentType = upload.metadata?.contentType || upload.metadata?.fileType || "";
        const filemd5 = upload.metadata?.filemd5;
        const imageId = upload.metadata?.imageId;
        // Extract specimen_id from URL
        const match = req.url.match(/\/specimens\/(.+?)\/images\/tus/);
        const specimen_id = match ? match[1] : null;
        if (!specimen_id) {
          const err: any = new Error('Specimen ID missing in URL.');
          err.status_code = 400;
          throw err;
        }
        const specimen = await findSpecimen(specimen_id);
        if (!specimen) {
          const err: any = new Error('Specimen not found.');
          err.status_code = 404;
          throw err;
        }
        let excludeImageId: number | undefined = undefined;
        if (imageId) {
          // Validate imageId belongs to this specimen
          const image = await SpecimenImage.findOne({ where: { id: imageId, specimenId: specimen.id } });
          if (!image) {
            const err: any = new Error('Invalid imageId: not found or does not belong to this specimen.');
            err.status_code = 404;
            throw err;
          }
          excludeImageId = Number(imageId);
        }
        if (filemd5) {
          const collision = await checkMd5Collision(specimen.id, filemd5, excludeImageId);
          if (collision) {
            const err: any = new Error('Duplicate image: file with this MD5 already exists for this specimen.');
            err.status_code = 409;
            throw err;
          }
        }
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

          const imageId = upload.metadata?.imageId;
          // Check MD5 if provided in metadata
          const expectedMd5 = upload.metadata?.filemd5;
          if (expectedMd5 && expectedMd5 !== filemd5) {
            return {
              status_code: 400,
              body: JSON.stringify({ message: 'MD5 mismatch: file corrupted during upload.' })
            };
          }

          if (imageId) {
            // Replace existing image
            const image = await SpecimenImage.findOne({ where: { id: imageId, specimenId: specimen.id } });
            if (!image) {
              return {
                status_code: 400,
                body: JSON.stringify({ message: 'Invalid imageId: not found or does not belong to this specimen.' })
              };
            }
            // Check for MD5 collision with other images for this specimen
            const collision = await checkMd5Collision(specimen.id, filemd5, Number(imageId));
            if (collision) {
              return {
                status_code: 409,
                body: JSON.stringify({ message: 'Duplicate image: file with this MD5 already exists for this specimen.' })
              };
            }
            // Update the image record
            await image.update({ imageKey, filemd5 });
            await specimen.update({ thumbnailImageId: image.id });

            return {
              status_code: 204,
              body: JSON.stringify({
                imageId: image.id,
                imageUrl: `/specimens/${specimen.specimenId}/images/${image.id}`
              })
            };
          } else {
            // Check for MD5 collision in DB after upload
            const collision = await checkMd5Collision(specimen.id, filemd5);
            if (collision) {
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
            return {
              status_code: 204,
              body: JSON.stringify({
                imageId: newImage.id,
                imageUrl: `/specimens/${specimen.specimenId}/images/${newImage.id}`
              })
            };
          }
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