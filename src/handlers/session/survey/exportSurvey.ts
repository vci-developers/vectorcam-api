import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from '../common';
import { SurveillanceForm, Session, Site, Device, Program } from '../../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Export surveillance forms data',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      programId: { type: 'number' },
      programCountry: { type: 'string' }
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

export async function exportSurveillanceFormsCSV(
  request: FastifyRequest<{ 
    Querystring: { 
      startDate?: string; 
      endDate?: string;
      programId?: string;
      programCountry?: string;
    } 
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, programId, programCountry } = request.query;
    
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before end date' });
    }
    
    // Build query conditions for surveillance forms
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

    // Build include conditions with nested filtering
    const includeConditions = [
      {
        model: Session,
        as: 'session',
        include: [
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
        ]
      }
    ];

    // Fetch surveillance forms based on filters
    const surveillanceForms = await SurveillanceForm.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: includeConditions
    });

    // Generate CSV header with comprehensive data
    let csv = 'ID,NumPeopleSleptInHouse,WasIrsConducted,MonthsSinceIrs,NumLlinsAvailable,LlinType,LlinBrand,NumPeopleSleptUnderLlin,CreatedAt,UpdatedAt,SessionID,SessionFrontendID,SessionHouseNumber,SessionCollectorTitle,SessionCollectorName,SessionCollectionDate,SessionCollectionMethod,SessionSpecimenCondition,SessionNotes,SessionCreatedAt,SessionCompletedAt,SessionSubmittedAt,SessionUpdatedAt,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteSentinelSite,SiteHealthCenter,ProgramID,ProgramName,ProgramCountry,DeviceID,DeviceModel,DeviceRegisteredAt\n';

    // Generate CSV rows
    for (const form of surveillanceForms) {
      // Safe approach to access associated models
      const session = form.get('session') as any;
      const site = session?.site as any;
      const device = session?.device as any;
      const program = site?.program as any;
      
      const row = [
        form.id,
        form.numPeopleSleptInHouse || 'N/A',
        form.wasIrsConducted ? 'Yes' : (form.wasIrsConducted === false ? 'No' : 'N/A'),
        form.monthsSinceIrs || 'N/A',
        form.numLlinsAvailable || 'N/A',
        form.llinType || 'N/A',
        form.llinBrand || 'N/A',
        form.numPeopleSleptUnderLlin || 'N/A',
        form.createdAt.toISOString(),
        form.updatedAt.toISOString(),
        form.sessionId,
        session?.frontendId || 'N/A',
        session?.houseNumber || 'N/A',
        session?.collectorTitle || 'N/A',
        session?.collectorName || 'N/A',
        session?.collectionDate?.toISOString() || 'N/A',
        session?.collectionMethod || 'N/A',
        session?.specimenCondition || 'N/A',
        session?.notes || 'N/A',
        session?.createdAt?.toISOString() || 'N/A',
        session?.completedAt?.toISOString() || 'N/A',
        session?.submittedAt?.toISOString() || 'N/A',
        session?.updatedAt?.toISOString() || 'N/A',
        session?.siteId || 'N/A',
        site?.district || 'N/A',
        site?.subCounty || 'N/A',
        site?.parish || 'N/A',
        site?.sentinelSite || 'N/A',
        site?.healthCenter || 'N/A',
        program?.id || 'N/A',
        program?.name || 'N/A',
        program?.country || 'N/A',
        session?.deviceId || 'N/A',
        device?.model || 'N/A',
        device?.registeredAt?.toISOString() || 'N/A'
      ].join(',');
      
      csv += row + '\n';
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=surveillance-forms-export.csv');
    
    return reply.send(csv);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export surveillance forms as CSV');
  }
} 