import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, SurveillanceForm, SessionConflictResolution } from '../../db/models';
import { Op } from 'sequelize';

interface ResolveConflictRequest {
  sessionIds: number[];
  resolvedData: {
    collectorTitle?: string | null;
    collectorName?: string | null;
    collectionDate?: number | null;
    collectionMethod?: string | null;
    specimenCondition?: string | null;
    createdAt?: number | null;
    completedAt?: number | null;
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    type?: string;
    collectorLastTrainedOn?: number | null;
    hardwareId?: string | null;
    totalSpecimens?: number | null;
  };
  resolvedSurveillanceForm?: {
    numPeopleSleptInHouse?: number | null;
    wasIrsConducted?: boolean | null;
    monthsSinceIrs?: number | null;
    numLlinsAvailable?: number | null;
    llinType?: string | null;
    llinBrand?: string | null;
    numPeopleSleptUnderLlin?: number | null;
  } | null;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Resolve conflicts between multiple sessions in the same site and month',
  body: {
    type: 'object',
    required: ['sessionIds', 'resolvedData'],
    properties: {
      sessionIds: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
      },
      resolvedData: {
        type: 'object',
        properties: {
          collectorTitle: { type: ['string', 'null'] },
          collectorName: { type: ['string', 'null'] },
          collectionDate: { type: ['number', 'null'] },
          collectionMethod: { type: ['string', 'null'] },
          specimenCondition: { type: ['string', 'null'] },
          createdAt: { type: ['number', 'null'] },
          completedAt: { type: ['number', 'null'] },
          notes: { type: ['string', 'null'] },
          latitude: { type: ['number', 'null'] },
          longitude: { type: ['number', 'null'] },
          type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'] },
          collectorLastTrainedOn: { type: ['number', 'null'] },
          hardwareId: { type: ['string', 'null'], maxLength: 64 },
          totalSpecimens: { type: ['number', 'null'] },
        },
      },
      resolvedSurveillanceForm: {
        type: ['object', 'null'],
        properties: {
          numPeopleSleptInHouse: { type: ['number', 'null'] },
          wasIrsConducted: { type: ['boolean', 'null'] },
          monthsSinceIrs: { type: ['number', 'null'] },
          numLlinsAvailable: { type: ['number', 'null'] },
          llinType: { type: ['string', 'null'] },
          llinBrand: { type: ['string', 'null'] },
          numPeopleSleptUnderLlin: { type: ['number', 'null'] },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        resolutionId: { type: 'number' },
        updatedSessionCount: { type: 'number' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function resolveConflict(
  request: FastifyRequest<{ Body: ResolveConflictRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionIds, resolvedData, resolvedSurveillanceForm } = request.body;

    // Validate that at least 2 sessions are provided
    if (sessionIds.length < 2) {
      return reply.code(400).send({ error: 'At least 2 session IDs are required' });
    }

    // Fetch all sessions
    const sessions = await Session.findAll({
      where: {
        id: {
          [Op.in]: sessionIds,
        },
      },
      include: [
        {
          model: SurveillanceForm,
          as: 'surveillanceForm',
          required: false,
        },
      ],
    });

    // Verify all sessions were found
    if (sessions.length !== sessionIds.length) {
      const foundIds = sessions.map(s => s.id);
      const missingIds = sessionIds.filter(id => !foundIds.includes(id));
      return reply.code(404).send({
        error: `Sessions not found: ${missingIds.join(', ')}`,
      });
    }

    // Validate all sessions are under the same site
    const siteIds = new Set(sessions.map(s => s.siteId));
    if (siteIds.size > 1) {
      return reply.code(400).send({
        error: 'All sessions must be under the same site',
      });
    }

    // Validate all sessions are in the same month and year
    const monthYearPairs = new Set(
      sessions.map(s => {
        const date = s.collectionDate || s.createdAt;
        if (!date) {
          throw new Error(`Session ${s.id} has no valid date`);
        }
        return `${date.getMonth() + 1}-${date.getFullYear()}`;
      })
    );

    if (monthYearPairs.size > 1) {
      return reply.code(400).send({
        error: 'All sessions must be in the same month and year',
      });
    }

    const siteId = sessions[0].siteId;
    const referenceDate = sessions[0].collectionDate || sessions[0].createdAt;
    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();

    // Check if user has access to this site
    const siteAccess = request.siteAccess;
    if (siteAccess && siteAccess.userSites.length > 0) {
      // If userSites is not empty, check if user has access to this specific site
      if (!siteAccess.userSites.includes(siteId)) {
        return reply.code(403).send({
          error: 'Forbidden: You do not have access to resolve conflicts for this site',
        });
      }
    }

    // Prepare before data
    const beforeData = {
      sessions: sessions.map(session => ({
        sessionId: session.id,
        frontendId: session.frontendId,
        collectorTitle: session.collectorTitle,
        collectorName: session.collectorName,
        collectionDate: session.collectionDate ? session.collectionDate.getTime() : null,
        collectionMethod: session.collectionMethod,
        specimenCondition: session.specimenCondition,
        createdAt: session.createdAt ? session.createdAt.getTime() : null,
        completedAt: session.completedAt ? session.completedAt.getTime() : null,
        notes: session.notes,
        latitude: session.latitude,
        longitude: session.longitude,
        type: session.type,
        collectorLastTrainedOn: session.collectorLastTrainedOn
          ? session.collectorLastTrainedOn.getTime()
          : null,
        hardwareId: session.hardwareId,
        totalSpecimens: session.totalSpecimens,
      })),
      surveillanceForms: [] as any[],
    };

    // Get surveillance forms
    for (const session of sessions) {
      const form = await SurveillanceForm.findOne({
        where: { sessionId: session.id },
      });

      if (form) {
        beforeData.surveillanceForms.push({
          sessionId: session.id,
          numPeopleSleptInHouse: form.numPeopleSleptInHouse,
          wasIrsConducted: form.wasIrsConducted,
          monthsSinceIrs: form.monthsSinceIrs,
          numLlinsAvailable: form.numLlinsAvailable,
          llinType: form.llinType,
          llinBrand: form.llinBrand,
          numPeopleSleptUnderLlin: form.numPeopleSleptUnderLlin,
        });
      }
    }

    // Update all sessions with resolved data
    const updateData: any = {};
    if (resolvedData.collectorTitle !== undefined) updateData.collectorTitle = resolvedData.collectorTitle;
    if (resolvedData.collectorName !== undefined) updateData.collectorName = resolvedData.collectorName;
    if (resolvedData.collectionDate !== undefined) {
      updateData.collectionDate = resolvedData.collectionDate ? new Date(resolvedData.collectionDate) : null;
    }
    if (resolvedData.collectionMethod !== undefined) updateData.collectionMethod = resolvedData.collectionMethod;
    if (resolvedData.specimenCondition !== undefined) updateData.specimenCondition = resolvedData.specimenCondition;
    if (resolvedData.createdAt !== undefined) {
      updateData.createdAt = resolvedData.createdAt ? new Date(resolvedData.createdAt) : null;
    }
    if (resolvedData.completedAt !== undefined) {
      updateData.completedAt = resolvedData.completedAt ? new Date(resolvedData.completedAt) : null;
    }
    if (resolvedData.notes !== undefined) updateData.notes = resolvedData.notes;
    if (resolvedData.latitude !== undefined) updateData.latitude = resolvedData.latitude;
    if (resolvedData.longitude !== undefined) updateData.longitude = resolvedData.longitude;
    if (resolvedData.type !== undefined) updateData.type = resolvedData.type;
    if (resolvedData.collectorLastTrainedOn !== undefined) {
      updateData.collectorLastTrainedOn = resolvedData.collectorLastTrainedOn
        ? new Date(resolvedData.collectorLastTrainedOn)
        : null;
    }
    if (resolvedData.hardwareId !== undefined) updateData.hardwareId = resolvedData.hardwareId;
    if (resolvedData.totalSpecimens !== undefined) updateData.totalSpecimens = resolvedData.totalSpecimens;
    await Session.update(updateData, {
      where: {
        id: {
          [Op.in]: sessionIds,
        },
      },
    });

    // Update surveillance forms if provided
    if (resolvedSurveillanceForm) {
      const formUpdateData: any = {};
      if (resolvedSurveillanceForm.numPeopleSleptInHouse !== undefined) {
        formUpdateData.numPeopleSleptInHouse = resolvedSurveillanceForm.numPeopleSleptInHouse;
      }
      if (resolvedSurveillanceForm.wasIrsConducted !== undefined) {
        formUpdateData.wasIrsConducted = resolvedSurveillanceForm.wasIrsConducted;
      }
      if (resolvedSurveillanceForm.monthsSinceIrs !== undefined) {
        formUpdateData.monthsSinceIrs = resolvedSurveillanceForm.monthsSinceIrs;
      }
      if (resolvedSurveillanceForm.numLlinsAvailable !== undefined) {
        formUpdateData.numLlinsAvailable = resolvedSurveillanceForm.numLlinsAvailable;
      }
      if (resolvedSurveillanceForm.llinType !== undefined) {
        formUpdateData.llinType = resolvedSurveillanceForm.llinType;
      }
      if (resolvedSurveillanceForm.llinBrand !== undefined) {
        formUpdateData.llinBrand = resolvedSurveillanceForm.llinBrand;
      }
      if (resolvedSurveillanceForm.numPeopleSleptUnderLlin !== undefined) {
        formUpdateData.numPeopleSleptUnderLlin = resolvedSurveillanceForm.numPeopleSleptUnderLlin;
      }

      await SurveillanceForm.update(formUpdateData, {
        where: {
          sessionId: {
            [Op.in]: sessionIds,
          },
        },
      });
    }

    // Get user ID from request if available (from auth middleware)
    const userId = (request as any).user?.id || null;

    // Create conflict resolution log
    const resolution = await SessionConflictResolution.create({
      resolvedByUserId: userId,
      sessionIds,
      siteId,
      month,
      year,
      beforeData,
      afterData: {
        ...resolvedData,
        surveillanceForm: resolvedSurveillanceForm || null,
      },
    });

    return reply.send({
      message: 'Conflict resolved successfully',
      resolutionId: resolution.id,
      updatedSessionCount: sessions.length,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Failed to resolve conflict',
    });
  }
}

