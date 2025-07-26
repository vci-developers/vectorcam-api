import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, MultipartUpload } from '../../../db/models';
import { handleError, findSpecimen } from '../../specimen/common';
import { findSession } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Delete a specimen for a session by specimen_id',
  params: {
    type: 'object',
    required: ['session_id', 'specimen_id'],
    properties: {
      session_id: { type: 'string' },
      specimen_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } }
    }
  }
};

export async function deleteSessionSpecimen(
  request: FastifyRequest<{ Params: { session_id: string; specimen_id: string } }>,
  reply: FastifyReply
) {
  const { session_id, specimen_id } = request.params;
  try {
    // Fetch session first
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    // Use session.id (number) for findSpecimen
    const specimen = await findSpecimen(specimen_id, undefined, session.id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }
    // Delete associated images, inference results, uploads
    const specimenImages = await SpecimenImage.findAll({ where: { specimenId: specimen.id } });
    const imageIds = specimenImages.map(img => img.id);
    if (imageIds.length > 0) {
      await InferenceResult.destroy({ where: { specimenImageId: imageIds } });
    }
    await SpecimenImage.destroy({ where: { specimenId: specimen.id } });
    await MultipartUpload.destroy({ where: { specimenId: specimen.id } });
    await specimen.destroy();
    return reply.send({ message: 'Specimen deleted successfully' });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete specimen');
  }
} 