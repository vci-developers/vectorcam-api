import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult } from '../../../db/models';
import { handleError, findSpecimen } from '../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Delete a specimen image',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' },
      image_id: { type: 'number' }
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
  request: FastifyRequest<{ Params: { specimen_id: string; image_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    // Check if the specimen exists
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }
    // Check if the image exists and belongs to the specimen
    const image = await SpecimenImage.findOne({ where: { id: image_id, specimenId: specimen.id } });
    if (!image) {
      return reply.code(404).send({ error: 'Image not found for this specimen' });
    }
    // Delete inference result if exists
    await InferenceResult.destroy({ where: { specimenImageId: image_id } });
    // Delete the image
    await SpecimenImage.destroy({ where: { id: image_id } });
    return reply.send({ message: 'Image deleted successfully' });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete specimen image');
  }
} 