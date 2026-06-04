import { FastifyRequest, FastifyReply } from 'fastify';
import {
  Form,
  FormAnswer,
  FormQuestion,
  Session,
  SessionConflictResolution,
  SessionUnit,
  Site,
  SurveillanceForm,
} from '../../db/models';
import { SessionState } from '../../db/models/Session';
import { Op } from 'sequelize';
import { getChangedFields, logReviewAction } from '../../services/reviewActionLog.service';

interface ResolvedFormAnswer {
  questionId: number;
  value: unknown;
  dataType?: string;
}

interface ResolveConflictRequest {
  sessionIds?: number[];
  sessionUnitIds?: number[];
  resolvedData?: {
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
    expectedSpecimens?: number | null;
    state?: SessionState;
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
  resolvedFormAnswers?: ResolvedFormAnswer[] | null;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Resolve conflicts between multiple sessions or session units in the same site and month',
  body: {
    type: 'object',
    properties: {
      sessionIds: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
      },
      sessionUnitIds: {
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
          type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'] },
          collectorLastTrainedOn: { type: ['number', 'null'] },
          hardwareId: { type: ['string', 'null'], maxLength: 64 },
          expectedSpecimens: { type: ['number', 'null'] },
          state: { type: 'string', enum: Object.values(SessionState) },
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
      resolvedFormAnswers: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          required: ['questionId', 'value'],
          properties: {
            questionId: { type: 'number' },
            value: {},
            dataType: { type: 'string' },
          },
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
        updatedSessionUnitCount: { type: 'number' },
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
    const {
      sessionIds: requestedSessionIds,
      sessionUnitIds,
      resolvedData = {},
      resolvedSurveillanceForm,
      resolvedFormAnswers,
    } = request.body;
    const userId = request.user?.id ?? null;
    const hasSessionIds = Array.isArray(requestedSessionIds) && requestedSessionIds.length > 0;
    const hasSessionUnitIds = Array.isArray(sessionUnitIds) && sessionUnitIds.length > 0;

    if (hasSessionIds === hasSessionUnitIds) {
      return reply.code(400).send({ error: 'Provide either sessionIds or sessionUnitIds' });
    }

    if (hasSessionIds && requestedSessionIds!.length < 2) {
      return reply.code(400).send({ error: 'At least 2 session IDs are required' });
    }

    if (hasSessionUnitIds && sessionUnitIds!.length < 2) {
      return reply.code(400).send({ error: 'At least 2 session unit IDs are required' });
    }

    if (hasSessionUnitIds && Object.keys(resolvedData).length > 0) {
      return reply.code(400).send({ error: 'resolvedData can only be used with sessionIds' });
    }

    if (hasSessionUnitIds && resolvedSurveillanceForm) {
      return reply.code(400).send({ error: 'resolvedSurveillanceForm can only be used with sessionIds' });
    }

    if (hasSessionUnitIds && (!resolvedFormAnswers || resolvedFormAnswers.length === 0)) {
      return reply.code(400).send({ error: 'resolvedFormAnswers are required when resolving session units' });
    }

    let sessionUnits: SessionUnit[] = [];
    let sessions: Session[];
    let sessionIds: number[];

    if (hasSessionIds) {
      sessionIds = requestedSessionIds!;
      sessions = await Session.findAll({
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
    } else {
      sessionUnits = await SessionUnit.findAll({
        where: {
          id: {
            [Op.in]: sessionUnitIds!,
          },
        },
        include: [
          {
            model: Session,
            as: 'session',
            required: true,
          },
        ],
      });

      if (sessionUnits.length !== sessionUnitIds!.length) {
        const foundIds = sessionUnits.map(unit => unit.id);
        const missingIds = sessionUnitIds!.filter(id => !foundIds.includes(id));
        return reply.code(404).send({
          error: `Session units not found: ${missingIds.join(', ')}`,
        });
      }

      const sessionsById = new Map<number, Session>();
      for (const unit of sessionUnits) {
        const session = unit.get('session') as Session | undefined;
        if (!session) {
          return reply.code(404).send({ error: `Session not found for session unit ${unit.id}` });
        }
        sessionsById.set(session.id, session);
      }
      sessions = Array.from(sessionsById.values());
      sessionIds = sessions.map(session => session.id);
    }

    // Validate all target sessions are under the same site
    const siteIds = new Set(sessions.map(s => s.siteId));
    if (siteIds.size > 1) {
      return reply.code(400).send({
        error: hasSessionUnitIds
          ? 'All session units must be under the same site'
          : 'All sessions must be under the same site',
      });
    }

    // Validate all target sessions are in the same month and year
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
        error: hasSessionUnitIds
          ? 'All session units must be in sessions from the same month and year'
          : 'All sessions must be in the same month and year',
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

    const targetAnswerScope = hasSessionUnitIds ? 'SESSION_UNIT' : 'SESSION';
    const formAnswerQuestionIds = Array.from(
      new Set((resolvedFormAnswers ?? []).map(answer => answer.questionId))
    );
    let resolvedFormAnswersFormId: number | null = null;
    let formQuestionsById = new Map<number, FormQuestion>();

    if (formAnswerQuestionIds.length > 0) {
      const site = await Site.findByPk(siteId);
      if (!site) {
        return reply.code(404).send({ error: `Site not found: ${siteId}` });
      }

      const questions = await FormQuestion.findAll({
        where: { id: { [Op.in]: formAnswerQuestionIds } },
        include: [{ model: Form, as: 'form', required: true }],
      });

      formQuestionsById = new Map(questions.map(question => [question.id, question]));

      for (const questionId of formAnswerQuestionIds) {
        if (!formQuestionsById.has(questionId)) {
          return reply.code(400).send({ error: `Question ${questionId} does not exist` });
        }
      }

      for (const question of questions) {
        const form = question.get('form') as Form | undefined;
        if (!form || form.programId !== site.programId) {
          return reply.code(400).send({
            error: `Question ${question.id} does not belong to the program for this site`,
          });
        }

        if (form.version === '') {
          return reply.code(400).send({ error: `Question ${question.id} belongs to an unpublished form` });
        }

        if (question.answerScope !== targetAnswerScope) {
          return reply.code(400).send({
            error: hasSessionUnitIds
              ? `Question ${question.id} is session-scoped and cannot be resolved for session units`
              : `Question ${question.id} is unit-scoped and cannot be resolved at the session level`,
          });
        }

        if (resolvedFormAnswersFormId !== null && resolvedFormAnswersFormId !== question.formId) {
          return reply.code(400).send({ error: 'Resolved form answers must belong to the same form' });
        }

        resolvedFormAnswersFormId = question.formId;
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
        expectedSpecimens: session.expectedSpecimens,
        state: session.state,
        certifiedBy: session.certifiedBy,
      })),
      surveillanceForms: [] as any[],
      sessionUnits: sessionUnits.map(unit => ({
        sessionUnitId: unit.id,
        frontendId: unit.frontendId,
        sessionId: unit.sessionId,
        unitOrder: unit.unitOrder,
        createdAt: unit.createdAt ? unit.createdAt.getTime() : null,
        updatedAt: unit.updatedAt ? unit.updatedAt.getTime() : null,
      })),
      formAnswers: [] as any[],
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

    if (formAnswerQuestionIds.length > 0) {
      const formAnswers = await FormAnswer.findAll({
        where: {
          sessionId: { [Op.in]: sessionIds },
          questionId: { [Op.in]: formAnswerQuestionIds },
          sessionUnitId: hasSessionUnitIds ? { [Op.in]: sessionUnitIds! } : null,
        },
        order: [['session_id', 'ASC'], ['question_id', 'ASC']],
      });

      beforeData.formAnswers = formAnswers.map(answer => ({
        sessionId: answer.sessionId,
        sessionUnitId: answer.sessionUnitId,
        formId: answer.formId,
        questionId: answer.questionId,
        value: answer.value,
        dataType: answer.dataType,
        submittedAt: answer.submittedAt?.getTime?.() ?? null,
        createdAt: answer.createdAt?.getTime?.() ?? null,
        updatedAt: answer.updatedAt?.getTime?.() ?? null,
      }));
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
    if (resolvedData.expectedSpecimens !== undefined) updateData.expectedSpecimens = resolvedData.expectedSpecimens;
    if (resolvedData.state !== undefined) {
      updateData.state = resolvedData.state;
    }
    if (Object.keys(updateData).length > 0) {
      if (resolvedData.state !== undefined) {
        await Promise.all(
          sessions.map((session) => {
            const certifiedBy = resolvedData.state === SessionState.CERTIFIED
              ? (session.state === SessionState.CERTIFIED ? session.certifiedBy : userId)
              : null;

            return Session.update(
              { ...updateData, certifiedBy },
              { where: { id: session.id } }
            );
          })
        );
      } else {
        await Session.update(updateData, {
          where: {
            id: {
              [Op.in]: sessionIds,
            },
          },
        });
      }
    }

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

      if (Object.keys(formUpdateData).length > 0) {
        await SurveillanceForm.update(formUpdateData, {
          where: {
            sessionId: {
              [Op.in]: sessionIds,
            },
          },
        });
      }
    }

    if (resolvedFormAnswers && resolvedFormAnswers.length > 0) {
      const submittedAt = new Date();
      const now = new Date();
      const formAnswerTargets = hasSessionUnitIds
        ? sessionUnits.map(unit => ({ sessionId: unit.sessionId, sessionUnitId: unit.id }))
        : sessionIds.map(sessionId => ({ sessionId, sessionUnitId: null }));

      for (const target of formAnswerTargets) {
        for (const answer of resolvedFormAnswers) {
          const question = formQuestionsById.get(answer.questionId);
          if (!question) continue;

          const existing = await FormAnswer.findOne({
            where: {
              sessionId: target.sessionId,
              sessionUnitId: target.sessionUnitId,
              formId: question.formId,
              questionId: answer.questionId,
            },
          });

          if (existing) {
            await existing.update({
              value: answer.value,
              dataType: answer.dataType || existing.dataType || 'text',
              submittedAt,
              updatedAt: now,
            });
          } else {
            await FormAnswer.create({
              frontendId: null,
              sessionId: target.sessionId,
              sessionUnitId: target.sessionUnitId,
              formId: question.formId,
              questionId: answer.questionId,
              value: answer.value,
              dataType: answer.dataType || 'text',
              submittedAt,
              updatedAt: now,
            });
          }
        }
      }
    }

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
        sessionUnitIds: hasSessionUnitIds ? sessionUnitIds : null,
        surveillanceForm: resolvedSurveillanceForm || null,
        formAnswers: resolvedFormAnswers || null,
      },
    });

    const resolvedSessionKeys = Object.keys(resolvedData || {});
    const resolvedFormKeys = Object.keys(resolvedSurveillanceForm || {});
    const resolvedFormAnswerKeys = (resolvedFormAnswers || []).map(answer => `question:${answer.questionId}`);
    const sessionFieldChanges = getChangedFields({}, resolvedData as Record<string, unknown>, resolvedSessionKeys);
    const formFieldChanges = resolvedSurveillanceForm
      ? getChangedFields({}, resolvedSurveillanceForm as Record<string, unknown>, resolvedFormKeys)
      : {};
    const formAnswerChanges = resolvedFormAnswers
      ? getChangedFields(
          {},
          Object.fromEntries(
            resolvedFormAnswers.map(answer => [`question:${answer.questionId}`, answer.value])
          ),
          resolvedFormAnswerKeys
        )
      : {};

    try {
      await logReviewAction({
        siteId,
        year,
        month,
        action: hasSessionUnitIds ? 'resolve_session_unit_conflicts' : 'resolve_session_conflicts',
        userId,
        changes: {
          sessions: sessionFieldChanges,
          surveillanceForm: formFieldChanges,
          formAnswers: formAnswerChanges,
        },
        fields: {
          endpoint: '/sessions/conflicts/resolve',
          httpMethod: 'POST',
          entityType: 'session_conflict_resolution',
          entityId: resolution.id,
          sessionIds,
          sessionUnitIds: hasSessionUnitIds ? sessionUnitIds : undefined,
        },
        metadata: {
          updatedSessionCount: sessions.length,
          updatedSessionUnitCount: sessionUnits.length,
          resolutionId: resolution.id,
        },
      });
    } catch (logError) {
      request.log.error({ err: logError, resolutionId: resolution.id }, 'Failed to write review action log');
    }

    return reply.send({
      message: 'Conflict resolved successfully',
      resolutionId: resolution.id,
      updatedSessionCount: sessions.length,
      updatedSessionUnitCount: sessionUnits.length,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Failed to resolve conflict',
    });
  }
}

