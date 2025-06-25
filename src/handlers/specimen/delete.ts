import { FastifyRequest, FastifyReply } from 'fastify';
import { findSpecimen, handleError } from './common';
import { InferenceResult, SpecimenImage } from '../../db/models';

export const schema = {
  tags: ['Specimens'],
  description: 'Delete a specimen and all associated data',
  params: {
    type: 'object',
    required: ['specimen_id'],
    properties: {
      specimen_id: { type: 'string' }
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
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id } = request.params;
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Delete associated inference result(s)
    await InferenceResult.destroy({ where: { specimenId: specimen.id } });
    // Delete associated images
    await SpecimenImage.destroy({ where: { specimenId: specimen.id } });
    // Delete the specimen itself
    await specimen.destroy();

    return reply.code(200).send({ message: 'Specimen deleted successfully' });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete specimen');
  }
} 