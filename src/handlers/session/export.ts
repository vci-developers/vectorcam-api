import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from './common';
import { Site, Device, Session } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Export sessions data',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' }
    }
  },
  response: {
    200: {
      type: 'string'
    }
  }
};

export async function exportSessionsCSV(
  request: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate } = request.query;
    
    // Build query conditions
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      where.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      where.createdAt = {
        [Op.lte]: new Date(endDate)
      };
    }

    // Fetch sessions based on date range
    const sessions = await Session.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Device, as: 'device' },
        { model: Site, as: 'site' }
      ]
    });

    // Generate CSV header
    let csv = 'SessionID,DeviceID,DeviceName,SiteID,SiteName,CreatedAt,SubmittedAt\n';

    // Generate CSV rows
    for (const session of sessions) {
      // Safe approach to access associated models
      const device = session.get('device') as any;
      const site = session.get('site') as any;
      
      const row = [
        session.id,
        session.deviceId,
        device?.name || 'N/A',
        session.siteId,
        site?.name || 'N/A',
        session.createdAt.toISOString(),
        session.submittedAt?.toISOString() || 'N/A'
      ].join(',');
      
      csv += row + '\n';
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=sessions-export.csv');
    
    reply.send(csv);
  } catch (error) {
    handleError(error, request, reply, 'Failed to export sessions as CSV');
  }
} 