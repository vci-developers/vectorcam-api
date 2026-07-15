import { FastifyReply, FastifyRequest } from 'fastify';
import { Op, Transaction } from 'sequelize';
import sequelize from '../../db';
import {
  Device,
  Form,
  FormAnswer,
  FormQuestion,
  Program,
  Session,
  Site,
  SurveillanceForm,
} from '../../db/models';
import { assignCollectionCycleOnSessionUpload } from '../program/collectionCycle/common';
import { formatSessionResponse } from '../session/common';

interface MockConflictSessionsBody {
  siteId: number;
  count?: number;
}

interface SessionFieldValues {
  collectorTitle: string;
  collectorName: string;
  collectionMethod: string;
  specimenCondition: string;
  notes: string;
}

interface SurveillanceFormValues {
  numPeopleSleptInHouse: number;
  wasIrsConducted: boolean;
  monthsSinceIrs: number | null;
  numLlinsAvailable: number;
  llinType: string | null;
  llinBrand: string | null;
  numPeopleSleptUnderLlin: number | null;
}

interface FormAnswerValue {
  value: unknown;
  dataType: string;
}

const COLLECTOR_TITLES = [
  'Village Health Team (VHT)',
  'Vector Control Officer (VCO)',
  'Field Operations Team (FOT)',
];

const COLLECTION_METHODS = [
  'Pyrethrum Spray Catch (PSC)',
  'CDC Light Trap (LTC)',
];

const SPECIMEN_CONDITIONS = ['Fresh', 'Dessicated'];

const LLIN_TYPE = 'Pyrethroid + PBO';
const LLIN_BRAND = 'OLYSET';

const FIRST_NAMES = ['John', 'Mary', 'Peter', 'Sarah', 'David', 'Jane', 'Moses', 'Grace'];
const LAST_NAMES = ['Mukasa', 'Nakato', 'Okello', 'Atim', 'Kiprotich', 'Nambi', 'Akello'];

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function shouldDiffer(): boolean {
  return Math.random() < 0.55;
}

function generateSessionFields(): SessionFieldValues {
  return {
    collectorTitle: getRandomItem(COLLECTOR_TITLES),
    collectorName: `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`,
    collectionMethod: getRandomItem(COLLECTION_METHODS),
    specimenCondition: getRandomItem(SPECIMEN_CONDITIONS),
    notes: `Mock conflict session ${randomIntBetween(1000, 9999)}`,
  };
}

function generateSurveillanceFormValues(): SurveillanceFormValues {
  const numPeopleSleptInHouse = randomIntBetween(1, 10);
  const wasIrsConducted = Math.random() < 0.4;
  const numLlinsAvailable = randomIntBetween(0, 6);

  return {
    numPeopleSleptInHouse,
    wasIrsConducted,
    monthsSinceIrs: wasIrsConducted ? randomIntBetween(1, 24) : null,
    numLlinsAvailable,
    llinType: numLlinsAvailable > 0 ? LLIN_TYPE : null,
    llinBrand: numLlinsAvailable > 0 ? LLIN_BRAND : null,
    numPeopleSleptUnderLlin: numLlinsAvailable > 0
      ? randomIntBetween(1, numPeopleSleptInHouse)
      : null,
  };
}

function generateAnswerValue(question: FormQuestion): FormAnswerValue {
  if (question.options && Array.isArray(question.options) && question.options.length > 0) {
    const option = getRandomItem(question.options);
    const value = typeof option === 'object' && option !== null && 'value' in option
      ? (option as { value: unknown }).value
      : option;
    return { value, dataType: question.type || 'text' };
  }

  switch (question.type) {
    case 'number':
      return { value: randomIntBetween(1, 100), dataType: 'number' };
    case 'boolean':
      return { value: Math.random() < 0.5, dataType: 'boolean' };
    default:
      return { value: `mock-${randomIntBetween(1000, 9999)}`, dataType: 'text' };
  }
}

function pickMaybeDifferent<T>(base: T, generator: () => T, differ: boolean): T {
  if (!differ) {
    return base;
  }

  let value = generator();
  let attempts = 0;
  while (value === base && attempts < 10) {
    value = generator();
    attempts += 1;
  }
  return value;
}

function pickSessionFields(base: SessionFieldValues): SessionFieldValues {
  return {
    collectorTitle: pickMaybeDifferent(base.collectorTitle, () => getRandomItem(COLLECTOR_TITLES), shouldDiffer()),
    collectorName: pickMaybeDifferent(base.collectorName, () => `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`, shouldDiffer()),
    collectionMethod: pickMaybeDifferent(base.collectionMethod, () => getRandomItem(COLLECTION_METHODS), shouldDiffer()),
    specimenCondition: pickMaybeDifferent(base.specimenCondition, () => getRandomItem(SPECIMEN_CONDITIONS), shouldDiffer()),
    notes: pickMaybeDifferent(base.notes, () => `Mock conflict session ${randomIntBetween(1000, 9999)}`, shouldDiffer()),
  };
}

function pickSurveillanceFormValues(base: SurveillanceFormValues): SurveillanceFormValues {
  const numPeopleSleptInHouse = pickMaybeDifferent(
    base.numPeopleSleptInHouse,
    () => randomIntBetween(1, 10),
    shouldDiffer()
  );
  const wasIrsConducted = pickMaybeDifferent(base.wasIrsConducted, () => Math.random() < 0.4, shouldDiffer());
  const numLlinsAvailable = pickMaybeDifferent(base.numLlinsAvailable, () => randomIntBetween(0, 6), shouldDiffer());

  return {
    numPeopleSleptInHouse,
    wasIrsConducted,
    monthsSinceIrs: wasIrsConducted ? randomIntBetween(1, 24) : null,
    numLlinsAvailable,
    llinType: numLlinsAvailable > 0 ? LLIN_TYPE : null,
    llinBrand: numLlinsAvailable > 0 ? LLIN_BRAND : null,
    numPeopleSleptUnderLlin: numLlinsAvailable > 0
      ? randomIntBetween(1, numPeopleSleptInHouse)
      : null,
  };
}

function pickFormAnswerValue(
  base: FormAnswerValue,
  question: FormQuestion
): FormAnswerValue {
  return pickMaybeDifferent(base, () => generateAnswerValue(question), shouldDiffer());
}

async function findPublishedForm(program: Program): Promise<Form | null> {
  if (program.formVersion) {
    const form = await Form.findOne({
      where: { programId: program.id, version: program.formVersion },
    });
    if (form && form.version !== '') {
      return form;
    }
  }

  return Form.findOne({
    where: {
      programId: program.id,
      version: { [Op.ne]: '' },
    },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
  });
}

async function findOrCreateDevice(programId: number, transaction: Transaction): Promise<Device> {
  const existing = await Device.findOne({
    where: { programId },
    order: [['id', 'ASC']],
    transaction,
  });
  if (existing) {
    return existing;
  }

  return Device.create({
    model: 'Mock Test Device',
    registeredAt: new Date(),
    programId,
  }, { transaction });
}

export const schema = {
  tags: ['Test'],
  description: 'Create mock conflict sessions for a site (admin only)',
  body: {
    type: 'object',
    required: ['siteId'],
    properties: {
      siteId: { type: 'number' },
      count: { type: 'number', minimum: 2, maximum: 10, default: 2 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        siteId: { type: 'number' },
        collectionDate: { type: 'number' },
        collectionCycleId: { type: ['number', 'null'] },
        sessionCount: { type: 'number' },
        formId: { type: ['number', 'null'] },
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              frontendId: { type: 'string' },
              collectorTitle: { type: ['string', 'null'] },
              collectorName: { type: ['string', 'null'] },
              collectionMethod: { type: ['string', 'null'] },
              specimenCondition: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              formAnswerCount: { type: 'number' },
            },
          },
        },
      },
    },
    400: {
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

export async function mockConflictSessions(
  request: FastifyRequest<{ Body: MockConflictSessionsBody }>,
  reply: FastifyReply
): Promise<void> {
  const siteId = request.body.siteId;
  const count = request.body.count ?? 2;

  if (!Number.isInteger(siteId) || siteId < 1) {
    return reply.code(400).send({ error: 'siteId must be a positive integer' });
  }

  if (!Number.isInteger(count) || count < 2 || count > 10) {
    return reply.code(400).send({ error: 'count must be an integer between 2 and 10' });
  }

  const transaction = await sequelize.transaction();

  try {
    const site = await Site.findByPk(siteId, { transaction });
    if (!site) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Site not found' });
    }

    const program = await Program.findByPk(site.programId, { transaction });
    if (!program) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Program not found for site' });
    }

    const device = await findOrCreateDevice(program.id, transaction);
    const collectionDate = new Date();
    const form = await findPublishedForm(program);
    const sessionQuestions = form
      ? await FormQuestion.findAll({
          where: {
            formId: form.id,
            answerScope: 'SESSION',
          },
          order: [['order', 'ASC'], ['id', 'ASC']],
          transaction,
        })
      : [];

    const baseSessionFields = generateSessionFields();
    const baseSurveillanceForm = generateSurveillanceFormValues();
    const baseFormAnswers = new Map<number, FormAnswerValue>(
      sessionQuestions.map((question) => [question.id, generateAnswerValue(question)])
    );

    const createdSessions: Array<{
      session: Session;
      formAnswerCount: number;
    }> = [];

    for (let index = 0; index < count; index += 1) {
      const sessionFields = index === 0
        ? baseSessionFields
        : pickSessionFields(baseSessionFields);
      const surveillanceFormValues = index === 0
        ? baseSurveillanceForm
        : pickSurveillanceFormValues(baseSurveillanceForm);

      const session = await Session.create({
        frontendId: `mock_conflict_${siteId}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 10)}`,
        collectorTitle: sessionFields.collectorTitle,
        collectorName: sessionFields.collectorName,
        collectionDate,
        collectionMethod: sessionFields.collectionMethod,
        specimenCondition: sessionFields.specimenCondition,
        submittedAt: collectionDate,
        notes: sessionFields.notes,
        siteId: site.id,
        deviceId: device.id,
        type: 'SURVEILLANCE',
        collectorLastTrainedOn: collectionDate,
        createdAt: collectionDate,
      }, { transaction });

      await SurveillanceForm.create({
        sessionId: session.id,
        ...surveillanceFormValues,
      }, { transaction });

      await assignCollectionCycleOnSessionUpload(session.id, transaction);
      await session.reload({ transaction });

      let formAnswerCount = 0;
      if (form && sessionQuestions.length > 0) {
        const answers = sessionQuestions.map((question) => {
          const base = baseFormAnswers.get(question.id)!;
          const answerValue = index === 0
            ? base
            : pickFormAnswerValue(base, question);

          return {
            sessionId: session.id,
            sessionUnitId: null,
            formId: form.id,
            questionId: question.id,
            value: answerValue.value,
            dataType: answerValue.dataType,
            submittedAt: collectionDate,
          };
        });

        await FormAnswer.bulkCreate(answers, { transaction });
        formAnswerCount = answers.length;
      }

      createdSessions.push({ session, formAnswerCount });
    }

    if (!site.hasData) {
      await site.update({ hasData: true }, { transaction });
    }

    await transaction.commit();

    const collectionCycleId = createdSessions[0]?.session.collectionCycleId ?? null;

    return reply.code(201).send({
      message: `Created ${count} mock conflict sessions for site ${siteId}`,
      siteId,
      collectionDate: collectionDate.getTime(),
      collectionCycleId,
      sessionCount: count,
      formId: form?.id ?? null,
      sessions: createdSessions.map(({ session, formAnswerCount }) => ({
        ...formatSessionResponse(session),
        formAnswerCount,
      })),
    });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to create mock conflict sessions' });
  }
}
