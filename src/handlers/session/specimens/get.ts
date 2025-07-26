import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, Site, Device } from '../../../db/models';
import { formatSpecimenResponse, findSpecimen, handleError } from '../../specimen/common';
import { findSession } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get a single specimen for a session by specimen_id',
  params: {
    type: 'object',
    required: ['session_id', 'specimen_id'],
    properties: {
      session_id: { type: 'string' },
      specimen_id: { type: 'string' }
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
                  abdomenStatusLogits: { type: 'array', items: { type: 'number' } }
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
                        abdomenStatusLogits: { type: 'array', items: { type: 'number' } }
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
            houseNumber: { type: ['string', 'null'] },
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
                sentinelSite: { type: ['string', 'null'] },
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

export async function getSessionSpecimen(
  request: FastifyRequest<{ Params: { session_id: string; specimen_id: string } }>,
  reply: FastifyReply
) {
  try {
    const { session_id, specimen_id } = request.params;

    // Fetch session first
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    const include = [
      {
        model: Session,
        as: 'session',
        include: [
          {
            model: Site,
            as: 'site',
            attributes: ['id', 'district', 'subCounty', 'parish', 'sentinelSite', 'healthCenter']
          },
          {
            model: Device,
            as: 'device',
            attributes: ['id', 'model', 'registeredAt']
          }
        ]
      }
    ];
    // Use session.id (number) for findSpecimen
    const specimen = await findSpecimen(specimen_id, include, session.id);

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
        houseNumber: specimenData.session.houseNumber,
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
          sentinelSite: specimenData.session.site.sentinelSite,
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