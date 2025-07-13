import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from './common';
import { Specimen, Session, Site, Device, Program, InferenceResult, SpecimenImage } from '../../db/models';
import { config } from '../../config/environment';

export const schema = {
  tags: ['Specimens'],
  description: 'Export specimens data',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      sessionId: { type: 'number' },
      sessionFrontendId: { type: 'string' },
      includeInferenceResult: { type: 'boolean' }
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

export interface ExportSpecimensCSVRequest {
  Querystring: { 
    startDate?: string; 
    endDate?: string;
    sessionId?: string;
    sessionFrontendId?: string;
    includeInferenceResult?: boolean;
  }
}

export async function exportSpecimensCSV(
  request: FastifyRequest<ExportSpecimensCSVRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { 
      startDate, 
      endDate, 
      sessionId, 
      sessionFrontendId, 
      includeInferenceResult 
    } = request.query;
    
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before end date' });
    }
    
    // Build query conditions for specimens
    const where: any = {};
    
    // Date filtering
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
        where: sessionId || sessionFrontendId ? {
          ...(sessionId && { id: parseInt(sessionId) }),
          ...(sessionFrontendId && { frontendId: sessionFrontendId })
        } : undefined,
        include: [
          {
            model: Site,
            as: 'site',
            include: [
              {
                model: Program,
                as: 'program'
              }
            ]
          },
          { model: Device, as: 'device' }
        ]
      },
      {
        model: SpecimenImage,
        as: 'thumbnailImage'
      }
    ];

    // Fetch specimens based on filters
    const specimens = await Specimen.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: includeConditions
    });

    // If inference results are requested, fetch them separately
    let inferenceResults: any = {};
    if (includeInferenceResult) {
      const specimenIds = specimens.map(s => s.id);
      const results = await InferenceResult.findAll({
        where: { specimenId: { [Op.in]: specimenIds } }
      });
      
      // Create a map for quick lookup
      results.forEach(result => {
        inferenceResults[result.specimenId] = result;
      });
    }

    // Generate CSV header
    let csvHeader = 'ID,SpecimenID,ImageUrl,Species,Sex,AbdomenStatus,CapturedAt,CreatedAt,UpdatedAt,SessionID,SessionFrontendID,SessionHouseNumber,SessionCollectorTitle,SessionCollectorName,SessionCollectionDate,SessionCollectionMethod,SessionSpecimenCondition,SessionNotes,SessionCreatedAt,SessionCompletedAt,SessionSubmittedAt,SessionUpdatedAt,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteSentinelSite,SiteHealthCenter,ProgramID,ProgramName,ProgramCountry,DeviceID,DeviceModel,DeviceRegisteredAt';
    
    // Add inference result columns if requested
    if (includeInferenceResult) {
        console.log(includeInferenceResult)
        csvHeader += ',InferenceResultID,BboxTopLeftX,BboxTopLeftY,BboxWidth,BboxHeight,SpeciesProbabilities,SexProbabilities,AbdomenStatusProbabilities,BboxConfidence,BboxClassId,InferenceResultCreatedAt,InferenceResultUpdatedAt';
    }
    
    csvHeader += '\n';

    // Generate CSV rows
    let csv = csvHeader;
    for (const specimen of specimens) {
      // Safe approach to access associated models
      const session = specimen.get('session') as any;
      const site = session?.site as any;
      const device = session?.device as any;
      const program = site?.program as any;
      const thumbnailImage = specimen.get('thumbnailImage') as any;
      const inferenceResult = inferenceResults[specimen.id] as any;
      
      // Format thumbnail image URL with domain
      const imageUrl = thumbnailImage 
        ? `${config.server.domain}/specimens/${specimen.specimenId}/images/${thumbnailImage.id}`
        : 'N/A';
      
      const row = [
        specimen.id,
        specimen.specimenId,
        imageUrl,
        specimen.species || 'N/A',
        specimen.sex || 'N/A',
        specimen.abdomenStatus || 'N/A',
        specimen.capturedAt?.toISOString() || 'N/A',
        specimen.createdAt.toISOString(),
        specimen.updatedAt.toISOString(),
        specimen.sessionId,
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
      ];

      // Add inference result data if requested and exists
      if (includeInferenceResult) {
        if (inferenceResult) {
          row.push(
            inferenceResult.id,
            inferenceResult.bboxTopLeftX,
            inferenceResult.bboxTopLeftY,
            inferenceResult.bboxWidth,
            inferenceResult.bboxHeight,
            inferenceResult.speciesProbabilities,
            inferenceResult.sexProbabilities,
            inferenceResult.abdomenStatusProbabilities,
            inferenceResult.bboxConfidence || 'N/A',
            inferenceResult.bboxClassId || 'N/A',
            inferenceResult.createdAt.toISOString(),
            inferenceResult.updatedAt.toISOString()
          );
        } else {
          // Add empty values for inference result columns
          row.push(
            'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'
          );
        }
      }
      
      csv += row.join(',') + '\n';
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=specimens-export.csv');
    
    return reply.send(csv);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export specimens as CSV');
  }
} 