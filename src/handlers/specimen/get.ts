import { FastifyRequest, FastifyReply } from 'fastify';
import { formatSpecimenResponse, handleError } from './common';
import { Session, Site, Device, Specimen } from '../../db/models';

export const schema = {
  tags: ['Specimens'],
  description: 'Get specimen details',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        specimenId: { type: 'string' },
        sessionId: { type: 'number' },
        thumbnailUrl: { type: ['string', 'null'] },
        thumbnailImageId: { type: ['number', 'null'] },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              url: { type: 'string' },
              species: { type: ['string', 'null'] },
              sex: { type: ['string', 'null'] },
              abdomenStatus: { type: ['string', 'null'] },
              capturedAt: { type: ['number', 'null'] },
              submittedAt: { type: 'number' },
              inferenceResult: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'number' },
                  bboxTopLeftX: { type: 'number' },
                  bboxTopLeftY: { type: 'number' },
                  bboxWidth: { type: 'number' },
                  bboxHeight: { type: 'number' },
                  bboxConfidence: { type: 'number' },
                  bboxClassId: { type: 'number' },
                  speciesLogits: { type: 'array', items: { type: 'number' } },
                  sexLogits: { type: 'array', items: { type: 'number' } },
                  abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                  speciesInferenceDuration: { type: ['number', 'null'] },
                  sexInferenceDuration: { type: ['number', 'null'] },
                  abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                  bboxDetectionDuration: { type: ['number', 'null'] }
                }
              }
            }
          }
        },
        thumbnailImage: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                id: { type: 'number' },
                url: { type: 'string' },
                species: { type: ['string', 'null'] },
                sex: { type: ['string', 'null'] },
                abdomenStatus: { type: ['string', 'null'] },
                capturedAt: { type: ['number', 'null'] },
                submittedAt: { type: 'number' },
                inferenceResult: {
                  anyOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        bboxTopLeftX: { type: 'number' },
                        bboxTopLeftY: { type: 'number' },
                        bboxWidth: { type: 'number' },
                        bboxHeight: { type: 'number' },
                        bboxConfidence: { type: 'number' },
                        bboxClassId: { type: 'number' },
                        speciesLogits: { type: 'array', items: { type: 'number' } },
                        sexLogits: { type: 'array', items: { type: 'number' } },
                        abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                        speciesInferenceDuration: { type: ['number', 'null'] },
                        sexInferenceDuration: { type: ['number', 'null'] },
                        abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                        bboxDetectionDuration: { type: ['number', 'null'] }
                      }
                    }
                  ]
                }
              }
            }
          ]
        },
        session: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            frontendId: { type: 'string' },
            collectorTitle: { type: ['string', 'null'] },
            collectorName: { type: ['string', 'null'] },
            collectionDate: { type: ['number', 'null'] },
            collectionMethod: { type: ['string', 'null'] },
            specimenCondition: { type: ['string', 'null'] },
            createdAt: { type: 'number' },
            completedAt: { type: ['number', 'null'] },
            submittedAt: { type: 'number' },
            notes: { type: ['string', 'null'] },
            siteId: { type: 'number' },
            deviceId: { type: 'number' },
            site: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                district: { type: ['string', 'null'] },
                subCounty: { type: ['string', 'null'] },
                parish: { type: ['string', 'null'] },
                villageName: { type: ['string', 'null'] },
                houseNumber: { type: 'string' },
                isActive: { type: 'boolean' },
                healthCenter: { type: ['string', 'null'] }
              }
            },
            device: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                model: { type: 'string' },
                registeredAt: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }
};

export async function getSpecimenDetails(
  request: FastifyRequest<{ Params: { specimen_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    
    const include = [
      {
        model: Session,
        as: 'session',
        include: [
          {
            model: Site,
            as: 'site',
            attributes: ['id', 'district', 'subCounty', 'parish', 'villageName', 'houseNumber', 'isActive', 'healthCenter']
          },
          {
            model: Device,
            as: 'device',
            attributes: ['id', 'model', 'registeredAt']
          }
        ]
      }
    ];
    const specimen = await Specimen.findByPk(specimen_id, { include });

    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Format response with associations
    const specimenData = specimen.get({ plain: true }) as any;
    const baseResponse = await formatSpecimenResponse(specimen, true);
    
    const response = {
      ...baseResponse,
      session: specimenData.session ? {
        id: specimenData.session.id,
        frontendId: specimenData.session.frontendId,
        collectorTitle: specimenData.session.collectorTitle,
        collectorName: specimenData.session.collectorName,
        collectionDate: specimenData.session.collectionDate ? new Date(specimenData.session.collectionDate).getTime() : null,
        collectionMethod: specimenData.session.collectionMethod,
        specimenCondition: specimenData.session.specimenCondition,
        createdAt: new Date(specimenData.session.createdAt).getTime(),
        completedAt: specimenData.session.completedAt ? new Date(specimenData.session.completedAt).getTime() : null,
        submittedAt: new Date(specimenData.session.submittedAt).getTime(),
        notes: specimenData.session.notes,
        siteId: specimenData.session.siteId,
        deviceId: specimenData.session.deviceId,
        site: specimenData.session.site ? {
          id: specimenData.session.site.id,
          district: specimenData.session.site.district,
          subCounty: specimenData.session.site.subCounty,
          parish: specimenData.session.site.parish,
          villageName: specimenData.session.site.villageName,
          houseNumber: specimenData.session.site.houseNumber,
          isActive: specimenData.session.site.isActive,
          healthCenter: specimenData.session.site.healthCenter
        } : null,
        device: specimenData.session.device ? {
          id: specimenData.session.device.id,
          model: specimenData.session.device.model,
          registeredAt: new Date(specimenData.session.device.registeredAt).getTime()
        } : null
      } : null
    };

    return reply.send(response);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get specimen details');
  }
} 