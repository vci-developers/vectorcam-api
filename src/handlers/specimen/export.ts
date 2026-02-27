import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { handleError } from './common';
import { Specimen, Session, Site, Device, Program, InferenceResult, SpecimenImage } from '../../db/models';
import { config } from '../../config/environment';
import { formatSiteResponse } from '../site/common';

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
  tags: ['Specimens'],
  description: 'Export specimens data',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      sessionId: { type: 'number' },
      sessionFrontendId: { type: 'string' },
      sessionType: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'], description: 'Filter by session type' },
      programId: { type: 'number' },
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
    sessionType?: string;
    programId?: string;
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
      sessionType,
      programId,
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
        where: sessionId || sessionFrontendId || sessionType ? {
          ...(sessionId && { id: parseInt(sessionId) }),
          ...(sessionFrontendId && { frontendId: sessionFrontendId }),
          ...(sessionType && { type: sessionType })
        } : undefined,
        include: [
          {
            model: Site,
            as: 'site',
            include: [
              {
                model: Program,
                as: 'program',
                where: programId ? { id: parseInt(programId) } : undefined
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
    let csvHeader = 'SpecimenID,ShouldProcessFurther,ExpectedImages,ImageID,ImageUrl,ImageS3Key,FileMD5,Species,Sex,AbdomenStatus,CapturedAt,ImageSubmittedAt,ImageUpdatedAt,SessionID,SessionFrontendID,SessionCollectorTitle,SessionCollectorName,SessionCollectionDate,SessionCollectionMethod,SessionSpecimenCondition,SessionNotes,SessionCreatedAt,SessionCompletedAt,SessionSubmittedAt,SessionUpdatedAt,SessionLatitude,SessionLongitude,SessionType,SessionCollectorLastTrainedOn,SessionHardwareID,SessionExpectedSpecimens,SessionState,SiteID,SiteDistrict,SiteSubCounty,SiteParish,SiteVillageName,SiteHouseNumber,SiteIsActive,SiteHealthCenter,SiteLocationHierarchy,ProgramID,ProgramName,ProgramCountry,DeviceID,DeviceModel,DeviceRegisteredAt';
    
    // Add inference result columns if requested
    if (includeInferenceResult) {
        csvHeader += ',InferenceResultID,BboxTopLeftX,BboxTopLeftY,BboxWidth,BboxHeight,SpeciesLogits,SexLogits,AbdomenStatusLogits,BboxConfidence,BboxClassId,SpeciesInferenceDuration,SexInferenceDuration,AbdomenStatusInferenceDuration,BboxDetectionDuration,InferenceResultCreatedAt,InferenceResultUpdatedAt';
    }
    
    csvHeader += '\n';

    // Generate CSV rows (one per image)
    let csv = csvHeader;
    for (const specimen of specimens) {
      const session = specimen.get('session') as any;
      const site = session?.site as any;
      const device = session?.device as any;
      const program = site?.program as any;
      const formattedSite = site ? await formatSiteResponse(site) : undefined;
      const siteLocationHierarchy = formattedSite ? JSON.stringify(formattedSite) : '';
      // Get all images for this specimen
      const images = await SpecimenImage.findAll({ where: { specimenId: specimen.id } });
      for (const img of images) {
        // Get inference result for this image if requested
        let inferenceResult = null;
        if (includeInferenceResult) {
          inferenceResult = await InferenceResult.findOne({ where: { specimenImageId: img.id } });
        }
        // Check if image file is uploaded by checking if imageKey exists and is not empty
        const imageUrl = img.imageKey && img.imageKey.trim() !== '' 
          ? `${config.server.domain}/specimens/${specimen.id}/images/${img.id}`
          : '';
        const row = [
          escapeCSVField(specimen.specimenId),
          escapeCSVField(specimen.shouldProcessFurther),
          escapeCSVField(specimen.expectedImages),
          escapeCSVField(img.id),
          escapeCSVField(imageUrl),
          escapeCSVField(img.imageKey),
          escapeCSVField(img.filemd5),
          escapeCSVField(img.species),
          escapeCSVField(img.sex),
          escapeCSVField(img.abdomenStatus),
          escapeCSVField(img.capturedAt ? img.capturedAt.toISOString() : null),
          escapeCSVField(img.createdAt.toISOString()),
          escapeCSVField(img.updatedAt.toISOString()),
          escapeCSVField(specimen.sessionId),
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
          escapeCSVField(session?.latitude),
          escapeCSVField(session?.longitude),
          escapeCSVField(session?.type),
          escapeCSVField(session?.collectorLastTrainedOn?.toISOString()),
          escapeCSVField(session?.hardwareId),
          escapeCSVField(session?.expectedSpecimens),
          escapeCSVField(session?.state),
          escapeCSVField(session?.siteId),
          escapeCSVField(formattedSite?.district ?? ''),
          escapeCSVField(formattedSite?.subCounty ?? ''),
          escapeCSVField(formattedSite?.parish ?? ''),
          escapeCSVField(formattedSite?.villageName ?? ''),
          escapeCSVField(formattedSite?.houseNumber ?? ''),
          escapeCSVField(site?.isActive),
          escapeCSVField(formattedSite?.healthCenter ?? ''),
          escapeCSVField(siteLocationHierarchy || ''),
          escapeCSVField(program?.id),
          escapeCSVField(program?.name),
          escapeCSVField(program?.country),
          escapeCSVField(session?.deviceId),
          escapeCSVField(device?.model),
          escapeCSVField(device?.registeredAt?.toISOString())
        ];
        if (includeInferenceResult) {
          if (inferenceResult) {
            row.push(
              escapeCSVField(inferenceResult.id),
              escapeCSVField(inferenceResult.bboxTopLeftX),
              escapeCSVField(inferenceResult.bboxTopLeftY),
              escapeCSVField(inferenceResult.bboxWidth),
              escapeCSVField(inferenceResult.bboxHeight),
              escapeCSVField(inferenceResult.speciesLogits),
              escapeCSVField(inferenceResult.sexLogits),
              escapeCSVField(inferenceResult.abdomenStatusLogits),
              escapeCSVField(inferenceResult.bboxConfidence),
              escapeCSVField(inferenceResult.bboxClassId),
              escapeCSVField(inferenceResult.speciesInferenceDuration),
              escapeCSVField(inferenceResult.sexInferenceDuration),
              escapeCSVField(inferenceResult.abdomenStatusInferenceDuration),
              escapeCSVField(inferenceResult.bboxDetectionDuration),
              escapeCSVField(inferenceResult.createdAt.toISOString()),
              escapeCSVField(inferenceResult.updatedAt.toISOString())
            );
          } else {
            row.push(
              escapeCSVField(null), escapeCSVField(null), escapeCSVField(null), escapeCSVField(null),
              escapeCSVField(null), escapeCSVField(null), escapeCSVField(null), escapeCSVField(null),
              escapeCSVField(null), escapeCSVField(null), escapeCSVField(null), escapeCSVField(null),
              escapeCSVField(null), escapeCSVField(null), escapeCSVField(null), escapeCSVField(null),
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