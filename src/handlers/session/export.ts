import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from './common';
import { Site, Device, Session, Program } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Export sessions data',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'number' },
      endDate: { type: 'number' },
      programId: { type: 'number' },
      programCountry: { type: 'string' },
      siteId: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'string'
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export interface ExportSessionsCSVRequest {
  Querystring: { 
    startDate?: string; 
    endDate?: string;
    programId?: string;
    programCountry?: string;
    siteId?: string;
  }
}

export async function exportSessionsCSV(
  request: FastifyRequest<ExportSessionsCSVRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, programId, programCountry, siteId } = request.query;
    
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before end date' });
    }
    
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

    // Add siteId filter if provided
    if (siteId) {
      where.siteId = parseInt(siteId);
    }

    // Build include conditions with nested filtering
    const includeConditions = [
      { 
        model: Site, 
        as: 'site',
        include: [
          {
            model: Program,
            as: 'program',
            where: programId || programCountry ? {
              ...(programId && { id: parseInt(programId) }),
              ...(programCountry && { country: programCountry })
            } : undefined
          }
        ]
      },
      { model: Device, as: 'device' }
    ];

    // Fetch sessions based on filters
    const sessions = await Session.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: includeConditions
    });

    // Generate CSV header with program data
    let csv = 'SessionID,FrontendID,HouseNumber,CollectorTitle,CollectorName,CollectionDate,CollectionMethod,SpecimenCondition,Notes,CreatedAt,CompletedAt,SubmittedAt,UpdatedAt,Latitude,Longitude,DeviceID,DeviceModel,DeviceRegisteredAt,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteSentinelSite,SiteHealthCenter,ProgramID,ProgramName,ProgramCountry\n';

    // Generate CSV rows
    for (const session of sessions) {
      // Safe approach to access associated models
      const site = session.get('site') as any;
      const device = session.get('device') as any;
      const program = site?.program as any;
      
      const row = [
        session.id,
        session.frontendId,
        session.houseNumber || 'N/A',
        session.collectorTitle || 'N/A',
        session.collectorName || 'N/A',
        session.collectionDate?.toISOString() || 'N/A',
        session.collectionMethod || 'N/A',
        session.specimenCondition || 'N/A',
        session.notes || 'N/A',
        session.createdAt.toISOString(),
        session.completedAt?.toISOString() || 'N/A',
        session.submittedAt.toISOString(),
        session.updatedAt.toISOString(),
        session.latitude !== null && session.latitude !== undefined ? session.latitude : 'N/A',
        session.longitude !== null && session.longitude !== undefined ? session.longitude : 'N/A',
        session.deviceId,
        device?.model || 'N/A',
        device?.registeredAt?.toISOString() || 'N/A',
        session.siteId,
        site?.district || 'N/A',
        site?.subCounty || 'N/A',
        site?.parish || 'N/A',
        site?.sentinelSite || 'N/A',
        site?.healthCenter || 'N/A',
        program?.id || 'N/A',
        program?.name || 'N/A',
        program?.country || 'N/A'
      ].join(',');
      
      csv += row + '\n';
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=sessions-export.csv');
    
    return reply.send(csv);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export sessions as CSV');
  }
} 