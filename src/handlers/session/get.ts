import { FastifyRequest, FastifyReply } from 'fastify';
import { formatSessionResponse, handleError, findSession } from './common';
import { Site, Device } from '../../db/models';
import { formatSiteResponse } from '../site/common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get session details by session_id (string: can be numeric or frontendId)',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    },
    required: ['session_id']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessionId: { type: 'number' },
        frontendId: { type: 'string' },
        collectorTitle: { type: ['string', 'null'] },
        collectorName: { type: ['string', 'null'] },
        collectionDate: { type: ['number', 'null'] },
        collectionMethod: { type: ['string', 'null'] },
        specimenCondition: { type: ['string', 'null'] },
        createdAt: { type: ['number', 'null'] },
        completedAt: { type: ['number', 'null'] },
        submittedAt: { type: 'number' },
        notes: { type: ['string', 'null'] },
        siteId: { type: 'number' },
        deviceId: { type: 'number' },
        latitude: { type: ['number', 'null'] },
        longitude: { type: ['number', 'null'] },
        type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'] },
        collectorLastTrainedOn: { type: ['number', 'null'] },
        hardwareId: { type: ['string', 'null'] },
        totalSpecimens: { type: 'number' },
        site: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            siteId: { type: 'number' },
            programId: { type: 'number' },
            district: { type: 'string', nullable: true },
            subCounty: { type: 'string', nullable: true },
            parish: { type: 'string', nullable: true },
            villageName: { type: 'string', nullable: true },
            houseNumber: { type: 'string' },
            isActive: { type: 'boolean' },
            healthCenter: { type: 'string', nullable: true },
            locationHierarchy: {
              type: 'object',
              additionalProperties: { type: 'string' }
            }
          }
        },
        device: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            deviceId: { type: 'number' },
            programId: { type: 'number' },
            model: { type: 'string' },
            registeredAt: { type: 'number' },
            submittedAt: { type: 'number' }
          }
        }
      }
    }
  }
};

export async function getSessionDetails(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const include = [
      {
        model: Site,
        as: 'site',
        attributes: [
          'id',
          'programId',
          'locationTypeId',
          'parentId',
          'name',
          'district',
          'subCounty',
          'parish',
          'villageName',
          'houseNumber',
          'isActive',
          'healthCenter',
          'hasData',
          'locationHierarchy',
        ],
      },
      {
        model: Device,
        as: 'device',
        attributes: ['id', 'programId', 'model', 'registeredAt', 'createdAt']
      }
    ];

    const session = await findSession(session_id, include);

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Format response with associations
    const sessionData = session.get({ plain: true }) as any;
    const siteInstance = session.get('site') as Site | undefined;
    const formattedSite = siteInstance ? await formatSiteResponse(siteInstance) : null;
    const response = {
      ...formatSessionResponse(session),
      site: formattedSite ? { ...formattedSite, id: formattedSite.siteId } : null,
      device: sessionData.device ? {
        id: sessionData.device.id,
        deviceId: sessionData.device.id,
        programId: sessionData.device.programId,
        model: sessionData.device.model,
        registeredAt: new Date(sessionData.device.registeredAt).getTime(),
        submittedAt: new Date(sessionData.device.createdAt).getTime()
      } : null
    };

    return reply.send(response);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session details');
  }
} 