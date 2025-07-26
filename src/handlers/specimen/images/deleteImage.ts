import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, Specimen } from '../../../db/models';
import { handleError, findSpecimenImage } from '../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Delete a specimen image',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' }
    },
    required: ['specimen_id', 'image_id']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteImage(
  request: FastifyRequest<{ Params: { specimen_id: number; image_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    // Check if the specimen exists
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }
    // Check if the image exists and belongs to the specimen (by id or filemd5)
    const image = await findSpecimenImage(specimen.id, image_id);
    if (!image) {
      return reply.code(404).send({ error: 'Image not found for this specimen' });
    }
    // Delete inference result if exists
    await InferenceResult.destroy({ where: { specimenImageId: image.id } });
    // Delete the image
    await SpecimenImage.destroy({ where: { id: image.id } });
    return reply.send({ message: 'Image deleted successfully' });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete specimen image');
  }
} 