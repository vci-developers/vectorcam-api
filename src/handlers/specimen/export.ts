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
      // Gather all image IDs for the selected specimens
      const specimenIds = specimens.map(s => s.id);
      const allImages = await SpecimenImage.findAll({ where: { specimenId: { [Op.in]: specimenIds } } });
      const imageIds = allImages.map(img => img.id);
      const results = await InferenceResult.findAll({
        where: { specimenImageId: { [Op.in]: imageIds } }
      });
      // Create a map for quick lookup by specimenImageId
      results.forEach(result => {
        inferenceResults[result.specimenImageId] = result;
      });
    }

    // Generate CSV header
    let csvHeader = 'SpecimenID,ImageID,ImageUrl,Species,Sex,AbdomenStatus,CapturedAt,ImageSubmittedAt,ImageUpdatedAt,SessionID,SessionFrontendID,SessionHouseNumber,SessionCollectorTitle,SessionCollectorName,SessionCollectionDate,SessionCollectionMethod,SessionSpecimenCondition,SessionNotes,SessionCreatedAt,SessionCompletedAt,SessionSubmittedAt,SessionUpdatedAt,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteSentinelSite,SiteHealthCenter,ProgramID,ProgramName,ProgramCountry,DeviceID,DeviceModel,DeviceRegisteredAt';
    
    // Add inference result columns if requested
    if (includeInferenceResult) {
        console.log(includeInferenceResult)
        csvHeader += ',InferenceResultID,BboxTopLeftX,BboxTopLeftY,BboxWidth,BboxHeight,SpeciesLogits,SexLogits,AbdomenStatusLogits,BboxConfidence,BboxClassId,InferenceResultCreatedAt,InferenceResultUpdatedAt';
    }
    
    csvHeader += '\n';

    // Generate CSV rows (one per image)
    let csv = csvHeader;
    for (const specimen of specimens) {
      const session = specimen.get('session') as any;
      const site = session?.site as any;
      const device = session?.device as any;
      const program = site?.program as any;
      // Get all images for this specimen
      const images = await SpecimenImage.findAll({ where: { specimenId: specimen.id } });
      for (const img of images) {
        // Get inference result for this image if requested
        let inferenceResult = null;
        if (includeInferenceResult) {
          inferenceResult = await InferenceResult.findOne({ where: { specimenImageId: img.id } });
        }
        const imageUrl = `${config.server.domain}/specimens/${specimen.id}/images/${img.id}`;
        const row = [
          specimen.specimenId,
          img.id,
          imageUrl,
          img.species || 'N/A',
          img.sex || 'N/A',
          img.abdomenStatus || 'N/A',
          img.capturedAt ? img.capturedAt.toISOString() : 'N/A',
          img.createdAt.toISOString(),
          img.updatedAt.toISOString(),
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
        if (includeInferenceResult) {
          if (inferenceResult) {
            row.push(
              inferenceResult.id,
              inferenceResult.bboxTopLeftX,
              inferenceResult.bboxTopLeftY,
              inferenceResult.bboxWidth,
              inferenceResult.bboxHeight,
              inferenceResult.speciesLogits,
              inferenceResult.sexLogits,
              inferenceResult.abdomenStatusLogits,
              inferenceResult.bboxConfidence || 'N/A',
              inferenceResult.bboxClassId || 'N/A',
              inferenceResult.createdAt.toISOString(),
              inferenceResult.updatedAt.toISOString()
            );
          } else {
            row.push(
              'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'
            );
          }
        }
        csv += row.join(',') + '\n';
      }
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=specimens-export.csv');
    
    return reply.send(csv);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export specimens as CSV');
  }
} 