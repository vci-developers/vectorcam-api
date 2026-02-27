import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from '../common';
import { SurveillanceForm, Session, Site, Device, Program } from '../../../db/models';
import { formatSiteResponse } from '../../site/common';

// Function to properly escape CSV fields
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return 'N/A';
  }
  
  const stringField = String(field);
  
  // If the field contains comma, newline, or quote, wrap it in quotes and escape internal quotes
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('\r') || stringField.includes('"')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }
  
  return stringField;
}

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

export interface ExportSurveillanceFormsCSVRequest {
  Querystring: { 
    startDate?: string; 
    endDate?: string;
    programId?: string;
    programCountry?: string;
  }
}

export async function exportSurveillanceFormsCSV(
  request: FastifyRequest<ExportSurveillanceFormsCSVRequest>,
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
    let csv =
      'ID,NumPeopleSleptInHouse,WasIrsConducted,MonthsSinceIrs,NumLlinsAvailable,LlinType,LlinBrand,NumPeopleSleptUnderLlin,CreatedAt,UpdatedAt,SessionID,SessionFrontendID,SessionCollectorTitle,SessionCollectorName,SessionCollectionDate,SessionCollectionMethod,SessionSpecimenCondition,SessionNotes,SessionCreatedAt,SessionCompletedAt,SessionSubmittedAt,SessionUpdatedAt,SessionLatitude,SessionLongitude,SessionType,SessionCollectorLastTrainedOn,SessionHardwareID,SessionExpectedSpecimens,SessionState,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteVillageName,SiteHouseNumber,SiteIsActive,SiteHealthCenter,SiteLocationHierarchy,ProgramID,ProgramName,ProgramCountry,DeviceID,DeviceModel,DeviceRegisteredAt\n';

    // Generate CSV rows
    for (const form of surveillanceForms) {
      // Safe approach to access associated models
      const session = form.get('session') as any;
      const site = session?.site as any;
      const device = session?.device as any;
      const program = site?.program as any;
      
      const formattedSite = site ? await formatSiteResponse(site) : undefined;
      const siteLocationHierarchy = formattedSite ? JSON.stringify(formattedSite) : '';

      const row = [
        form.id,
        escapeCSVField(form.numPeopleSleptInHouse),
        escapeCSVField(form.wasIrsConducted ? 'Yes' : (form.wasIrsConducted === false ? 'No' : 'N/A')),
        escapeCSVField(form.monthsSinceIrs),
        escapeCSVField(form.numLlinsAvailable),
        escapeCSVField(form.llinType),
        escapeCSVField(form.llinBrand),
        escapeCSVField(form.numPeopleSleptUnderLlin),
        escapeCSVField(form.createdAt.toISOString()),
        escapeCSVField(form.updatedAt.toISOString()),
        form.sessionId,
        escapeCSVField(session?.frontendId),
        escapeCSVField(session?.collectorTitle),
        escapeCSVField(session?.collectorName),
        escapeCSVField(session?.collectionDate?.toISOString()),
        escapeCSVField(session?.collectionMethod),
        escapeCSVField(session?.specimenCondition),
        escapeCSVField(session?.notes),
        escapeCSVField(session?.createdAt?.toISOString()),
        escapeCSVField(session?.completedAt?.toISOString()),
        escapeCSVField(session?.submittedAt?.toISOString()),
        escapeCSVField(session?.updatedAt?.toISOString()),
        escapeCSVField(session?.latitude !== null && session?.latitude !== undefined ? session.latitude : null),
        escapeCSVField(session?.longitude !== null && session?.longitude !== undefined ? session.longitude : null),
        escapeCSVField(session?.type),
        escapeCSVField(session?.collectorLastTrainedOn?.toISOString()),
        escapeCSVField(session?.hardwareId),
        escapeCSVField(session?.expectedSpecimens),
        escapeCSVField(session?.state),
        session?.siteId,
        escapeCSVField(formattedSite?.district ?? ''),
        escapeCSVField(formattedSite?.subCounty ?? ''),
        escapeCSVField(formattedSite?.parish ?? ''),
        escapeCSVField(formattedSite?.villageName ?? ''),
        escapeCSVField(formattedSite?.houseNumber ?? ''),
        escapeCSVField(site?.isActive),
        escapeCSVField(formattedSite?.healthCenter ?? ''),
        escapeCSVField(siteLocationHierarchy || ''),
        program?.id,
        escapeCSVField(program?.name),
        escapeCSVField(program?.country),
        session?.deviceId,
        escapeCSVField(device?.model),
        escapeCSVField(device?.registeredAt?.toISOString())
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