import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../../db';
import { Op } from 'sequelize';

interface SubmitSessionRequest {
  deviceId: string;
  siteId: string;
  createdAt: string;
}

interface UpdateSessionRequest {
  siteId?: string;
}

export async function submitSession(
  request: FastifyRequest<{ Body: SubmitSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { deviceId, siteId, createdAt } = request.body;

    // Check if device exists
    const device = await models.Device.findByPk(deviceId);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Check if site exists
    const site = await models.Site.findByPk(siteId);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Generate a unique session ID with 'SES' prefix
    const sessionId = `SES${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const submittedAt = new Date().toISOString();

    // Create the session
    const session = await models.Session.create({
      id: sessionId,
      deviceId,
      siteId,
      createdAt: new Date(createdAt),
      submittedAt: new Date(submittedAt),
    });

    reply.code(201).send({
      message: 'Session submitted successfully',
      session: {
        sessionId: session.id,
        deviceId: session.deviceId,
        siteId: session.siteId,
        createdAt: session.createdAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString(),
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to submit session' });
  }
}

export async function getSessionDetails(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await models.Session.findByPk(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    reply.send({
      sessionId: session.id,
      deviceId: session.deviceId,
      siteId: session.siteId,
      createdAt: session.createdAt.toISOString(),
      submittedAt: session.submittedAt?.toISOString(),
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get session details' });
  }
}

export async function updateSession(
  request: FastifyRequest<{ Params: { session_id: string }; Body: UpdateSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;
    const { siteId } = request.body;

    const session = await models.Session.findByPk(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if site exists when updating siteId
    if (siteId) {
      const site = await models.Site.findByPk(siteId);
      if (!site) {
        return reply.code(404).send({ error: 'Site not found' });
      }
    }

    // Update the session
    await session.update({
      siteId: siteId || session.siteId,
    });

    reply.send({
      message: 'Session updated successfully',
      session: {
        sessionId: session.id,
        deviceId: session.deviceId,
        siteId: session.siteId,
        createdAt: session.createdAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString(),
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to update session' });
  }
}

export async function deleteSession(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await models.Session.findByPk(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if session has related specimens
    const specimensCount = await models.Specimen.count({ where: { sessionId: session_id } });
    if (specimensCount > 0) {
      return reply.code(400).send({ 
        error: 'Session cannot be deleted because it has associated specimens' 
      });
    }

    // Delete the session
    await session.destroy();

    reply.send({
      message: 'Session deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to delete session' });
  }
}

export async function getSessionPaginated(
  request: FastifyRequest<{ Querystring: { page?: string; size?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const page = parseInt(request.query.page || '1', 10);
    const size = parseInt(request.query.size || '10', 10);
    const offset = (page - 1) * size;

    const { count, rows } = await models.Session.findAndCountAll({
      limit: size,
      offset,
      order: [['createdAt', 'DESC']],
    });

    reply.send({
      totalItems: count,
      totalPages: Math.ceil(count / size),
      currentPage: page,
      sessions: rows.map(session => ({
        sessionId: session.id,
        deviceId: session.deviceId,
        siteId: session.siteId,
        createdAt: session.createdAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString(),
      })),
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get sessions' });
  }
}

export async function getSessionsByUser(
  request: FastifyRequest<{ Params: { user_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { user_id } = request.params;

    // Note: This function assumes there would be a user association in Device model
    // Since we don't have it yet, just return empty array for now
    // In a real implementation, we'd have a proper query with joins
    
    // Just send an empty result for now
    reply.send({ sessions: [] });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get sessions by user' });
  }
}

export async function getSessionsBySite(
  request: FastifyRequest<{ Params: { site_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    // Check if site exists
    const site = await models.Site.findByPk(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    const sessions = await models.Session.findAll({
      where: { siteId: site_id },
      order: [['createdAt', 'DESC']],
    });

    reply.send({
      sessions: sessions.map(session => ({
        sessionId: session.id,
        deviceId: session.deviceId,
        siteId: session.siteId,
        createdAt: session.createdAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString(),
      })),
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get sessions by site' });
  }
}

export async function getSessionSurvey(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    // Check if session exists
    const session = await models.Session.findByPk(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Get the surveillance form for this session
    const form = await models.SurveillanceForm.findOne({
      where: { sessionId: session_id },
    });

    if (!form) {
      return reply.code(404).send({ error: 'Surveillance form not found for this session' });
    }

    reply.send({
      formId: form.id,
      sessionId: form.sessionId,
      collectionDate: form.collectionDate?.toISOString().split('T')[0],
      officerName: form.officerName,
      officerTitle: form.officerTitle,
      peopleInHouse: form.peopleInHouse,
      isBednetAvailable: form.isBednetAvailable,
      numberOfBednetsAvailable: form.numberOfBednetsAvailable,
      numberOfPeopleSleptUnderBednet: form.numberOfPeopleSleptUnderBednet,
      bednetType: form.bednetType,
      bednetBrand: form.bednetBrand,
      isIrsSprayed: form.isIrsSprayed,
      irsDate: form.irsDate?.toISOString().split('T')[0],
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get session survey' });
  }
}

export async function getSessionSpecimens(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    // Check if session exists
    const session = await models.Session.findByPk(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Get all specimens for this session
    const specimens = await models.Specimen.findAll({
      where: { sessionId: session_id },
      // Note: We'd need to set up proper association between Specimen and YoloBox
      // For now, we'll just return the specimens without YoloBox data
    });

    reply.send({
      specimens: specimens.map(specimen => ({
        specimenId: specimen.id,
        sessionId: specimen.sessionId,
        species: specimen.species,
        sex: specimen.sex,
        abdomenStatus: specimen.abdomenStatus,
        imageUrl: specimen.imageUrl,
        // We'd get YoloBox data from associations, but for now just return null
        yoloBox: null
      })),
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get session specimens' });
  }
}

export async function exportSessionsCSV(
  request: FastifyRequest<{ Querystring: { format?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Only CSV format is supported for now
    if (request.query.format && request.query.format !== 'csv') {
      return reply.code(400).send({ error: 'Only CSV format is supported' });
    }

    // Get all sessions with related data
    const sessions = await models.Session.findAll({
      order: [['createdAt', 'DESC']],
    });

    // Convert to CSV format (headers)
    let csv = 'sessionId,deviceId,siteId,createdAt,submittedAt\n';
    
    // Add rows
    sessions.forEach(session => {
      csv += `${session.id},${session.deviceId},${session.siteId},${session.createdAt.toISOString()},${session.submittedAt?.toISOString() || ''}\n`;
    });

    // Set response headers
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=sessions.csv');
    
    reply.send(csv);
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to export sessions as CSV' });
  }
} 