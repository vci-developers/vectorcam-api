import { 
  Annotation, 
  AnnotationTask, 
  User, 
  Specimen, 
  SpecimenImage, 
  InferenceResult, 
  Session, 
  Site 
} from '../../db/models';
import { formatUserResponse, UserResponse } from '../user/common';
import { formatAnnotationTaskResponse, AnnotationTaskResponse } from '../annotation-task/common';
import { formatSpecimenResponse, SpecimenResponse, ImageResponse } from '../specimen/common';
import { formatSessionResponse, SessionResponse } from '../session/common';
import { formatSiteResponse, SiteResponse } from '../site/common';

// Annotation response format interface
export interface AnnotationResponse {
  id: number;
  annotationTaskId: number;
  annotatorId: number;
  specimenId: number;
  morphSpecies: string | null;
  morphSex: string | null;
  morphAbdomenStatus: string | null;
  notes: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  annotationTask?: AnnotationTaskResponse;
  annotator?: UserResponse;
  specimen?: SpecimenWithSessionResponse;
}

// Extended specimen response with session and site info
export interface SpecimenWithSessionResponse extends SpecimenResponse {
  session?: SessionWithSiteResponse;
}

// Extended session response with site info
export interface SessionWithSiteResponse extends SessionResponse {
  site?: SiteResponse;
}

// Specimen image response interface (reuse ImageResponse from specimen common)
export interface SpecimenImageResponse extends ImageResponse {}

// Helper to format annotation data consistently across endpoints
export function formatAnnotationResponse(
  annotation: Annotation, 
  includeRelated: boolean = false
): AnnotationResponse {
  const response: AnnotationResponse = {
    id: annotation.id,
    annotationTaskId: annotation.annotationTaskId,
    annotatorId: annotation.annotatorId,
    specimenId: annotation.specimenId,
    morphSpecies: annotation.morphSpecies || null,
    morphSex: annotation.morphSex || null,
    morphAbdomenStatus: annotation.morphAbdomenStatus || null,
    notes: annotation.notes || null,
    status: annotation.status,
    createdAt: annotation.createdAt.getTime(),
    updatedAt: annotation.updatedAt.getTime(),
  };

  if (includeRelated) {
    // Include annotation task if available
    if (annotation.get('annotationTask')) {
      response.annotationTask = formatAnnotationTaskResponse(annotation.get('annotationTask') as AnnotationTask);
    }

    // Include annotator if available
    if (annotation.get('annotator')) {
      response.annotator = formatUserResponse(annotation.get('annotator') as User);
    }

    // Include specimen with session and site if available
    if (annotation.get('specimen')) {
      const specimen = annotation.get('specimen') as any;
      response.specimen = {
        id: specimen.id,
        specimenId: specimen.specimenId,
        sessionId: specimen.sessionId,
        thumbnailUrl: null,
        thumbnailImageId: specimen.thumbnailImageId,
        images: [],
        thumbnailImage: null,
      };

      // Add thumbnail image if available
      if (specimen.thumbnailImage) {
        response.specimen.thumbnailImage = formatSpecimenImageResponse(specimen.thumbnailImage, specimen.id);
      }

      // Add session info if available
      if (specimen.session) {
        response.specimen.session = {
          ...formatSessionResponse(specimen.session),
        };

        // Add site info if available
        if (specimen.session.site) {
          response.specimen.session.site = formatSiteResponse(specimen.session.site);
        }
      }
    }
  }

  return response;
}

// Helper to format specimen image data
export function formatSpecimenImageResponse(image: SpecimenImage, specimenId?: number): SpecimenImageResponse {
  const response: SpecimenImageResponse = {
    id: image.id,
    url: specimenId ? `/specimens/${specimenId}/images/${image.id}` : `/images/${image.id}`,
    species: image.species || null,
    sex: image.sex || null,
    abdomenStatus: image.abdomenStatus || null,
    capturedAt: image.capturedAt ? image.capturedAt.getTime() : null,
    submittedAt: image.createdAt.getTime(),
    inferenceResult: null
  };

  // Include inference result if available
  if (image.get('inferenceResult')) {
    const inferenceResult = image.get('inferenceResult') as InferenceResult;
    response.inferenceResult = {
      id: inferenceResult.id,
      bboxTopLeftX: inferenceResult.bboxTopLeftX,
      bboxTopLeftY: inferenceResult.bboxTopLeftY,
      bboxWidth: inferenceResult.bboxWidth,
      bboxHeight: inferenceResult.bboxHeight,
      bboxConfidence: inferenceResult.bboxConfidence,
      bboxClassId: inferenceResult.bboxClassId,
      speciesLogits: inferenceResult.speciesLogits ? JSON.parse(inferenceResult.speciesLogits) : [],
      sexLogits: inferenceResult.sexLogits ? JSON.parse(inferenceResult.sexLogits) : [],
      abdomenStatusLogits: inferenceResult.abdomenStatusLogits ? JSON.parse(inferenceResult.abdomenStatusLogits) : [],
      speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
      sexInferenceDuration: inferenceResult.sexInferenceDuration,
      abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration
    };
  }

  return response;
}

// Check if annotation exists by ID
export async function findAnnotationById(annotationId: number): Promise<Annotation | null> {
  return await Annotation.findByPk(annotationId);
}

// Check if annotation exists by ID with all related data
export async function findAnnotationWithRelated(annotationId: number): Promise<Annotation | null> {
  return await Annotation.findByPk(annotationId, {
    include: [
      {
        model: AnnotationTask,
        as: 'annotationTask',
        attributes: ['id', 'userId', 'title', 'description', 'status', 'createdAt', 'updatedAt']
      },
      {
        model: User,
        as: 'annotator',
        attributes: ['id', 'email', 'privilege', 'isActive', 'createdAt', 'updatedAt']
      },
      {
        model: Specimen,
        as: 'specimen',
        attributes: ['id', 'specimenId', 'sessionId', 'thumbnailImageId'],
        include: [
          {
            model: SpecimenImage,
            as: 'thumbnailImage',
            attributes: ['id', 'imageKey', 'species', 'sex', 'abdomenStatus'],
            include: [
              {
                model: InferenceResult,
                as: 'inferenceResult',
                attributes: [
                  'id', 
                  'bboxTopLeftX', 
                  'bboxTopLeftY', 
                  'bboxWidth', 
                  'bboxHeight',
                  'speciesLogits',
                  'sexLogits', 
                  'abdomenStatusLogits', 
                  'bboxConfidence'
                ]
              }
            ]
          },
          {
            model: Session,
            as: 'session',
            attributes: ['id', 'frontendId', 'siteId', 'collectorName', 'collectionDate'],
            include: [
              {
                model: Site,
                as: 'site',
                attributes: ['id', 'district', 'subCounty', 'parish', 'villageName', 'houseNumber', 'isActive', 'healthCenter']
              }
            ]
          }
        ]
      }
    ]
  });
}

// Check if user can access annotation (owns the task)
export async function canUserAccessAnnotation(annotationId: number, userId: number): Promise<boolean> {
  const annotation = await Annotation.findByPk(annotationId, {
    include: [{
      model: AnnotationTask,
      as: 'annotationTask',
      where: { userId },
      attributes: ['id']
    }]
  });
  return !!annotation;
}
