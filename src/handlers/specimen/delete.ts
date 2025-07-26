import { FastifyRequest, FastifyReply } from 'fastify';
import { handleError } from './common';
import { InferenceResult, SpecimenImage, MultipartUpload, Specimen } from '../../db/models';

export const schema = {
  tags: ['Specimens'],
  description: 'Delete a specimen and all associated data',
  params: {
    type: 'object',
    required: ['specimen_id'],
    properties: {
      specimen_id: { type: 'number' }
    }
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

export async function deleteSpecimen(
  request: FastifyRequest<{ Params: { specimen_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id } = request.params;
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find all image IDs for this specimen
    const specimenImages = await SpecimenImage.findAll({ where: { specimenId: specimen.id } });
    const imageIds = specimenImages.map(img => img.id);
    // Delete associated inference result(s)
    if (imageIds.length > 0) {
      await InferenceResult.destroy({ where: { specimenImageId: imageIds } });
    }
    // Delete associated images
    await SpecimenImage.destroy({ where: { specimenId: specimen.id } });
    // Delete associated uploads
    await MultipartUpload.destroy({ where: { specimenId: specimen.id } });
    // Delete the specimen itself
    await specimen.destroy();

    return reply.code(200).send({ message: 'Specimen deleted successfully' });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete specimen');
  }
} 