import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction, Op } from 'sequelize';
import sequelize from '../../db';
import {
  AnnotationTask,
  Annotation,
  User,
  Specimen,
  Session,
  Site,
  Program,
  CollectionCycle,
} from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface CreateAnnotationTasksBody {
  title?: string;
  description?: string;
  programId: number;
  collectionCycleId: number;
  duplicates?: number;
  base?: number;
}

interface SpecimenWithAssociations extends Specimen {
  session: {
    id: number;
    collectionCycleId: number | null;
    site: {
      id: number;
      programId: number;
    };
  };
}

interface CreateAnnotationTasksRequest extends FastifyRequest {
  body: CreateAnnotationTasksBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Create annotation tasks for specimens in a collection cycle',
  description:
    'Creates annotation tasks by assigning unassigned specimens from the given collection cycle to superadmins in the same program, with overlapping duplicate specimens and unique base specimens (requires admin token)',
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 255 },
      description: { type: 'string' },
      programId: { type: 'number' },
      collectionCycleId: { type: 'number' },
      duplicates: { type: 'number', minimum: 0, default: 20 },
      base: { type: 'number', minimum: 0, default: 50 },
    },
    required: ['programId', 'collectionCycleId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tasksCreated: { type: 'number' },
        specimensAvailable: { type: 'number' },
        totalSpecimensAssigned: { type: 'number' },
        duplicateSpecimensCount: { type: 'number' },
        baseSpecimensCount: { type: 'number' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              annotatorId: { type: 'number' },
              title: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              annotator: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  name: { type: ['string', 'null'] },
                  privilege: { type: 'number' },
                  programId: { type: ['number', 'null'] },
                  isActive: { type: 'boolean' },
                },
              },
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
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const DUPLICATE_WINDOW_SIZE = 3;

export default async function createAnnotationTasks(
  request: CreateAnnotationTasksRequest,
  reply: FastifyReply
): Promise<void> {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const {
      title,
      description,
      programId,
      collectionCycleId,
      duplicates = 20,
      base = 50,
    } = request.body;

    if (!Number.isInteger(programId) || programId <= 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'programId must be a positive integer' });
    }
    if (!Number.isInteger(collectionCycleId) || collectionCycleId <= 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'collectionCycleId must be a positive integer' });
    }
    if (!Number.isInteger(duplicates) || duplicates < 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'duplicates must be a non-negative integer' });
    }
    if (!Number.isInteger(base) || base < 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'base must be a non-negative integer' });
    }
    if (duplicates + base === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'At least one of duplicates or base must be greater than 0' });
    }

    const program = await Program.findByPk(programId, { transaction });
    if (!program) {
      await transaction.rollback();
      return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
    }

    const collectionCycle = await CollectionCycle.findByPk(collectionCycleId, { transaction });
    if (!collectionCycle) {
      await transaction.rollback();
      return reply.code(400).send({ error: `Collection cycle not found with ID: ${collectionCycleId}` });
    }
    if (collectionCycle.programId !== programId) {
      await transaction.rollback();
      return reply.code(400).send({
        error: `Collection cycle ${collectionCycleId} does not belong to program ${programId}`,
      });
    }

    const superAdminUsers = await User.findAll({
      where: {
        programId,
        privilege: {
          [Op.gte]: 4,
        },
        isActive: true,
      },
      order: [['id', 'ASC']],
      transaction,
    });

    if (superAdminUsers.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({
        error: `No active annotation users found for program ${programId} to assign tasks to`,
      });
    }

    const availableSpecimens = (await Specimen.findAll({
      where: {
        id: {
          [Op.notIn]: sequelize.literal(
            `(SELECT DISTINCT a.specimen_id
              FROM annotations a
              INNER JOIN specimens sp ON sp.id = a.specimen_id
              INNER JOIN sessions sess ON sess.id = sp.session_id
              WHERE sess.collection_cycle_id = ${collectionCycleId}
                AND a.specimen_id IS NOT NULL)`
          ),
        },
      },
      include: [
        {
          model: Session,
          as: 'session',
          required: true,
          where: {
            collectionCycleId,
          },
          include: [
            {
              model: Site,
              as: 'site',
              required: true,
              where: {
                programId,
              },
            },
          ],
        },
      ],
      order: [['id', 'ASC']],
      transaction,
    })) as SpecimenWithAssociations[];

    if (availableSpecimens.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({
        error: `No unassigned specimens found for program ${programId} in collection cycle ${collectionCycleId}`,
      });
    }

    const shuffledSpecimens = shuffleArray(availableSpecimens);
    const duplicateCount = Math.min(duplicates, shuffledSpecimens.length);
    const duplicateSpecimens = shuffledSpecimens.slice(0, duplicateCount);
    const baseSpecimens = shuffledSpecimens.slice(duplicateCount, duplicateCount + base);

    request.log.info(
      `Collection cycle ${collectionCycleId}: ${availableSpecimens.length} eligible specimens, ` +
        `${duplicateSpecimens.length} duplicates, ${baseSpecimens.length} base`
    );

    const createdTasks: AnnotationTask[] = [];
    const userTasks: { [userId: number]: AnnotationTask } = {};
    const userSpecimenAssignments: { [userId: number]: SpecimenWithAssociations[] } = {};

    for (const user of superAdminUsers) {
      userSpecimenAssignments[user.id] = [];

      const task = await AnnotationTask.create(
        {
          userId: user.id,
          title: title || `Annotation Task - ${new Date().toISOString().split('T')[0]}`,
          description: description || `Assigned specimens for annotation by ${user.email}`,
          status: 'PENDING',
        },
        { transaction }
      );

      createdTasks.push(task);
      userTasks[user.id] = task;
    }

    for (let specimenIndex = 0; specimenIndex < duplicateSpecimens.length; specimenIndex++) {
      const specimen = duplicateSpecimens[specimenIndex];
      for (let offset = 0; offset < DUPLICATE_WINDOW_SIZE; offset++) {
        const adminIndex = (specimenIndex + offset) % superAdminUsers.length;
        const user = superAdminUsers[adminIndex];
        userSpecimenAssignments[user.id].push(specimen);
      }
    }

    const basePerAdmin = Math.floor(baseSpecimens.length / superAdminUsers.length);
    const extraBaseCount = baseSpecimens.length % superAdminUsers.length;
    let baseIndex = 0;
    for (let adminIndex = 0; adminIndex < superAdminUsers.length; adminIndex++) {
      const count = basePerAdmin + (adminIndex < extraBaseCount ? 1 : 0);
      const user = superAdminUsers[adminIndex];
      for (let j = 0; j < count; j++) {
        userSpecimenAssignments[user.id].push(baseSpecimens[baseIndex]);
        baseIndex++;
      }
    }

    const annotations: Array<{
      annotationTaskId: number;
      annotatorId: number;
      specimenId: number;
      status: string;
    }> = [];

    for (const user of superAdminUsers) {
      const task = userTasks[user.id];
      const assignedSpecimens = userSpecimenAssignments[user.id];

      if (!task) {
        request.log.warn(`No task found for user ${user.id}`);
        continue;
      }

      for (const specimen of assignedSpecimens) {
        annotations.push({
          annotationTaskId: task.id,
          annotatorId: user.id,
          specimenId: specimen.id,
          status: 'PENDING',
        });
      }
    }

    if (annotations.length > 0) {
      await Annotation.bulkCreate(annotations, { transaction });
    }

    const tasksWithUsers = await AnnotationTask.findAll({
      where: {
        id: createdTasks.map((task) => task.id),
      },
      include: [
        {
          model: User,
          as: 'user',
        },
      ],
      transaction,
    });

    await transaction.commit();

    const formattedTasks = tasksWithUsers.map((task) => formatAnnotationTaskResponse(task, true));

    const totalSpecimensAssigned = Object.values(userSpecimenAssignments).reduce(
      (total, specimens) => total + specimens.length,
      0
    );

    return reply.send({
      message: 'Annotation tasks created successfully',
      tasksCreated: createdTasks.length,
      specimensAvailable: availableSpecimens.length,
      totalSpecimensAssigned,
      duplicateSpecimensCount: duplicateSpecimens.length,
      baseSpecimensCount: baseSpecimens.length,
      tasks: formattedTasks,
    });
  } catch (error: any) {
    await transaction.rollback();
    request.log.error(error);

    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
