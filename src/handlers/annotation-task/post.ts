import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction, Op } from 'sequelize';
import sequelize from '../../db';
import { AnnotationTask, Annotation, User, Specimen } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface CreateAnnotationTasksBody {
  title?: string;
  description?: string;
}

interface CreateAnnotationTasksRequest extends FastifyRequest {
  body: CreateAnnotationTasksBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Create annotation tasks for unassigned specimens',
  description: 'Creates annotation tasks by assigning all unassigned specimens to superadmin users randomly and evenly (requires admin token)',
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 255 },
      description: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tasksCreated: { type: 'number' },
        specimensAssigned: { type: 'number' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number' },
              title: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  privilege: { type: 'number' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'number' },
                  updatedAt: { type: 'number' }
                }
              }
            }
          }
        }
      }
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

export default async function createAnnotationTasks(
  request: CreateAnnotationTasksRequest,
  reply: FastifyReply
): Promise<void> {
  const transaction: Transaction = await sequelize.transaction();
  
  try {
    const { title, description } = request.body;

    // Get all superadmin users (privilege = 2) who are active
    const superAdminUsers = await User.findAll({
      where: {
        privilege: 2,
        isActive: true
      },
      order: [['id', 'ASC']]
    });

    if (superAdminUsers.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'No active superadmin users found to assign tasks to' });
    }

    // Find all specimens that are not assigned to any annotation task yet
    // We do this by finding specimens that don't have any annotations
    const assignedSpecimenIds = await Annotation.findAll({
      attributes: ['specimenId'],
      transaction
    }).then(annotations => annotations.map(a => a.specimenId));

    const unassignedSpecimens = await Specimen.findAll({
      where: {
        id: {
          [Op.notIn]: assignedSpecimenIds.length > 0 ? assignedSpecimenIds : [0] // Use [0] as fallback to avoid empty array
        }
      },
      order: [['id', 'ASC']],
      transaction
    });

    if (unassignedSpecimens.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'No unassigned specimens found' });
    }

    // Shuffle specimens to randomize assignment
    const shuffledSpecimens = shuffleArray(unassignedSpecimens);
    
    // Create tasks for each superadmin user
    const createdTasks: AnnotationTask[] = [];
    const userTasks: { [userId: number]: AnnotationTask } = {};

    for (const user of superAdminUsers) {
      const task = await AnnotationTask.create({
        userId: user.id,
        title: title || `Annotation Task - ${new Date().toISOString().split('T')[0]}`,
        description: description || `Assigned specimens for annotation by ${user.email}`,
        status: 'PENDING'
      }, { transaction });

      createdTasks.push(task);
      userTasks[user.id] = task;
    }

    // Distribute specimens evenly among superadmin users
    const annotations: any[] = [];
    const baseSpecimensPerUser = Math.floor(shuffledSpecimens.length / superAdminUsers.length);
    const extraSpecimens = shuffledSpecimens.length % superAdminUsers.length;

    let specimenIndex = 0;
    
    for (let userIndex = 0; userIndex < superAdminUsers.length; userIndex++) {
      const user = superAdminUsers[userIndex];
      const task = userTasks[user.id];
      
      if (!task) {
        request.log.warn(`No task found for user ${user.id}`);
        continue;
      }
      
      // Calculate how many specimens this user should get
      const specimensForThisUser = baseSpecimensPerUser + (userIndex < extraSpecimens ? 1 : 0);
      
      // Assign specimens to this user's task
      for (let i = 0; i < specimensForThisUser; i++) {
        if (specimenIndex < shuffledSpecimens.length) {
          const specimen = shuffledSpecimens[specimenIndex];
          if (specimen && specimen.id) {
            annotations.push({
              annotationTaskId: task.id,
              annotatorId: user.id,
              specimenId: specimen.id,
              status: 'PENDING'
            });
          }
          specimenIndex++;
        }
      }
    }

    // Bulk create all annotations if we have any
    if (annotations.length > 0) {
      await Annotation.bulkCreate(annotations, { transaction });
    }

    // Fetch the created tasks with user details for response
    const tasksWithUsers = await AnnotationTask.findAll({
      where: {
        id: createdTasks.map(task => task.id)
      },
      include: [
        {
          model: User,
          as: 'user'
        }
      ],
      transaction
    });

    await transaction.commit();

    // Format response
    const formattedTasks = tasksWithUsers.map(task => formatAnnotationTaskResponse(task, true));

    return reply.send({
      message: 'Annotation tasks created successfully',
      tasksCreated: createdTasks.length,
      specimensAssigned: shuffledSpecimens.length,
      tasks: formattedTasks
    });

  } catch (error: any) {
    await transaction.rollback();
    request.log.error(error);
    
    // Don't send response if already sent
    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
