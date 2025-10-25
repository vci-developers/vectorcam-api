import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { 
  Annotation, 
  AnnotationTask, 
  User, 
  Specimen, 
  SpecimenImage, 
  InferenceResult
} from '../../db/models';
import { config } from '../../config/environment';

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
  tags: ['Annotations'],
  description: 'Export annotations data with specimen, image, and inference result information',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      annotationTaskId: { type: 'number' },
      annotatorId: { type: 'number' },
      status: { type: 'string', enum: ['PENDING', 'ANNOTATED', 'FLAGGED'] }
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

export interface ExportAnnotationsCSVRequest {
  Querystring: { 
    startDate?: string; 
    endDate?: string;
    annotationTaskId?: string;
    annotatorId?: string;
    status?: string;
  }
}

export async function exportAnnotationsCSV(
  request: FastifyRequest<ExportAnnotationsCSVRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { 
      startDate, 
      endDate, 
      annotationTaskId,
      annotatorId,
      status
    } = request.query;
    
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before end date' });
    }
    
    // Build query conditions for annotations
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

    // Filter by annotation task ID
    if (annotationTaskId) {
      where.annotationTaskId = parseInt(annotationTaskId);
    }

    // Filter by annotator ID
    if (annotatorId) {
      where.annotatorId = parseInt(annotatorId);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Fetch annotations with all related data
    const annotations = await Annotation.findAll({
      where,
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: AnnotationTask,
          as: 'annotationTask',
          attributes: ['id', 'userId', 'title', 'description', 'status']
        },
        {
          model: User,
          as: 'annotator',
          attributes: ['id', 'email']
        },
        {
          model: Specimen,
          as: 'specimen',
          required: false,
          include: [
            {
              model: SpecimenImage,
              as: 'thumbnailImage',
              required: false,
              include: [
                {
                  model: InferenceResult,
                  as: 'inferenceResult',
                  required: false
                }
              ]
            }
          ]
        }
      ]
    });

    // Generate CSV header
    const csvHeader = [
      // Annotation fields
      'AnnotationID',
      'AnnotationTaskID',
      'AnnotationTaskTitle',
      'AnnotationTaskDescription',
      'AnnotationTaskStatus',
      'AnnotatorID',
      'AnnotatorEmail',
      'MorphSpecies',
      'MorphSex',
      'MorphAbdomenStatus',
      'VisualSpecies',
      'VisualSex',
      'VisualAbdomenStatus',
      'AnnotationNotes',
      'AnnotationStatus',
      'AnnotationCreatedAt',
      'AnnotationUpdatedAt',
      
      // Specimen fields
      'SpecimenID',
      'SessionID',
      'SpecimenCreatedAt',
      
      // Thumbnail image fields
      'ThumbnailImageID',
      'ThumbnailImageUrl',
      'ThumbnailImageS3Key',
      'ThumbnailSpecies',
      'ThumbnailSex',
      'ThumbnailAbdomenStatus',
      'ThumbnailCapturedAt',
      'ThumbnailSubmittedAt',
      'ThumbnailUpdatedAt',
      
      // Inference result fields (for thumbnail)
      'InferenceResultID',
      'BboxTopLeftX',
      'BboxTopLeftY',
      'BboxWidth',
      'BboxHeight',
      'SpeciesLogits',
      'SexLogits',
      'AbdomenStatusLogits',
      'BboxConfidence',
      'BboxClassId',
      'SpeciesInferenceDuration',
      'SexInferenceDuration',
      'AbdomenStatusInferenceDuration',
      'BboxDetectionDuration',
      'InferenceResultCreatedAt',
      'InferenceResultUpdatedAt'
    ].join(',') + '\n';

    // Generate CSV rows
    let csv = csvHeader;
    
    for (const annotation of annotations) {
      const annotationTask = annotation.get('annotationTask') as any;
      const annotator = annotation.get('annotator') as any;
      const specimen = annotation.get('specimen') as any;
      const thumbnailImage = specimen?.get('thumbnailImage') as any;
      const inferenceResult = thumbnailImage?.get('inferenceResult') as any;

      // Build thumbnail image URL
      const thumbnailImageUrl = thumbnailImage?.imageKey && thumbnailImage.imageKey.trim() !== '' 
        ? `${config.server.domain}/specimens/${specimen.id}/images/${thumbnailImage.id}`
        : '';

      const row = [
        // Annotation fields
        escapeCSVField(annotation.id),
        escapeCSVField(annotation.annotationTaskId),
        escapeCSVField(annotationTask?.title),
        escapeCSVField(annotationTask?.description),
        escapeCSVField(annotationTask?.status),
        escapeCSVField(annotation.annotatorId),
        escapeCSVField(annotator?.email),
        escapeCSVField(annotation.morphSpecies),
        escapeCSVField(annotation.morphSex),
        escapeCSVField(annotation.morphAbdomenStatus),
        escapeCSVField(annotation.visualSpecies),
        escapeCSVField(annotation.visualSex),
        escapeCSVField(annotation.visualAbdomenStatus),
        escapeCSVField(annotation.notes),
        escapeCSVField(annotation.status),
        escapeCSVField(annotation.createdAt.toISOString()),
        escapeCSVField(annotation.updatedAt.toISOString()),
        
        // Specimen fields
        escapeCSVField(specimen?.specimenId),
        escapeCSVField(specimen?.sessionId),
        escapeCSVField(specimen?.createdAt ? specimen.createdAt.toISOString() : null),
        
        // Thumbnail image fields
        escapeCSVField(thumbnailImage?.id),
        escapeCSVField(thumbnailImageUrl),
        escapeCSVField(thumbnailImage?.imageKey),
        escapeCSVField(thumbnailImage?.species),
        escapeCSVField(thumbnailImage?.sex),
        escapeCSVField(thumbnailImage?.abdomenStatus),
        escapeCSVField(thumbnailImage?.capturedAt ? thumbnailImage.capturedAt.toISOString() : null),
        escapeCSVField(thumbnailImage?.createdAt ? thumbnailImage.createdAt.toISOString() : null),
        escapeCSVField(thumbnailImage?.updatedAt ? thumbnailImage.updatedAt.toISOString() : null),
        
        // Inference result fields
        escapeCSVField(inferenceResult?.id),
        escapeCSVField(inferenceResult?.bboxTopLeftX),
        escapeCSVField(inferenceResult?.bboxTopLeftY),
        escapeCSVField(inferenceResult?.bboxWidth),
        escapeCSVField(inferenceResult?.bboxHeight),
        escapeCSVField(inferenceResult?.speciesLogits),
        escapeCSVField(inferenceResult?.sexLogits),
        escapeCSVField(inferenceResult?.abdomenStatusLogits),
        escapeCSVField(inferenceResult?.bboxConfidence),
        escapeCSVField(inferenceResult?.bboxClassId),
        escapeCSVField(inferenceResult?.speciesInferenceDuration),
        escapeCSVField(inferenceResult?.sexInferenceDuration),
        escapeCSVField(inferenceResult?.abdomenStatusInferenceDuration),
        escapeCSVField(inferenceResult?.bboxDetectionDuration),
        escapeCSVField(inferenceResult?.createdAt ? inferenceResult.createdAt.toISOString() : null),
        escapeCSVField(inferenceResult?.updatedAt ? inferenceResult.updatedAt.toISOString() : null)
      ];

      csv += row.join(',') + '\n';
    }

    // Set response headers for file download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=annotations-export.csv');
    
    return reply.send(csv);
  } catch (error) {
    console.error(`Error in ${request.method} ${request.url}:`, error);
    return reply.code(500).send({ error: 'Failed to export annotations as CSV' });
  }
}

