import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction, Op } from 'sequelize';
import sequelize from '../../db';
import { AnnotationTask, Annotation, User, Specimen, Session, SpecimenImage } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface CreateAnnotationTasksBody {
  title?: string;
  description?: string;
  month: number;
  year: number;
}

interface SpecimenImageWithAssociations extends SpecimenImage {
  specimen: {
    id: number;
    session: {
      id: number;
      collectionDate: Date | null;
    };
  };
}

interface CreateAnnotationTasksRequest extends FastifyRequest {
  body: CreateAnnotationTasksBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Create annotation tasks for specimens from a specific month/year',
  description: 'Creates annotation tasks by randomly sampling up to 200 images from specimens collected in the specified month/year, with 15-20% overlap between superadmins (requires admin token)',
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 255 },
      description: { type: 'string' },
      month: { type: 'number', minimum: 1, maximum: 12 },
      year: { type: 'number', minimum: 2000, maximum: 3000 }
    },
    required: ['month', 'year']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tasksCreated: { type: 'number' },
        imagesAvailable: { type: 'number' },
        totalImagesAssigned: { type: 'number' },
        maxImagesPerAdmin: { type: 'number' },
        overlapCount: { type: 'number' },
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
    const { title, description, month, year } = request.body;

    // Validate month and year
    if (month < 1 || month > 12) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Month must be between 1 and 12' });
    }
    if (year < 2000 || year > 3000) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Year must be between 2000 and 3000' });
    }

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

    // Calculate the date range for the specified month and year (using UTC)
    const startDate = new Date(Date.UTC(year, month - 1, 1)); // month is 0-indexed in Date constructor
    const endDate = new Date(Date.UTC(year, month, 0)); // Last day of the month
    endDate.setUTCHours(23, 59, 59, 999); // Set to end of day in UTC

    // Find all specimen images from specimens whose sessions were collected in the specified month/year
    // and that are not already assigned to any annotation task
    const assignedSpecimenIds = await Annotation.findAll({
      attributes: ['specimenId'],
      transaction
    }).then(annotations => annotations.map(a => a.specimenId));

    const availableImages = await SpecimenImage.findAll({
      include: [
        {
          model: Specimen,
          as: 'specimen',
          required: true,
          where: {
            id: {
              [Op.notIn]: assignedSpecimenIds.length > 0 ? assignedSpecimenIds : [0]
            }
          },
          include: [
            {
              model: Session,
              as: 'session',
              required: true,
              where: {
                collectionDate: {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate
                }
              }
            }
          ]
        }
      ],
      order: [['id', 'ASC']],
      transaction
    }) as SpecimenImageWithAssociations[];

    if (availableImages.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: `No unassigned specimen images found for ${month}/${year}` });
    }

    // Shuffle images to randomize assignment
    const shuffledImages = shuffleArray(availableImages);
    
    // Calculate maximum images per superadmin (200) and overlap (15-20%)
    const maxImagesPerAdmin = Math.min(200, Math.floor(shuffledImages.length / superAdminUsers.length));
    const overlapPercentage = 0.2; // 20% (middle of 15-20% range)
    const overlapCount = Math.floor(maxImagesPerAdmin * overlapPercentage);
    
    request.log.info(`Total images: ${shuffledImages.length}, Max per admin: ${maxImagesPerAdmin}, Overlap: ${overlapCount}`);
    
    if (maxImagesPerAdmin < 1) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Not enough images available for assignment' });
    }
    
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

    // Assign images to superadmin users with overlap
    const annotations: any[] = [];
    const userImageAssignments: { [userId: number]: SpecimenImageWithAssociations[] } = {};
    
    // First, assign unique images to each user
    let imageIndex = 0;
    for (let userIndex = 0; userIndex < superAdminUsers.length; userIndex++) {
      const user = superAdminUsers[userIndex];
      const userImages: SpecimenImageWithAssociations[] = [];
      
      // Assign unique images (excluding overlap)
      const uniqueImagesCount = maxImagesPerAdmin - overlapCount;
      for (let i = 0; i < uniqueImagesCount && imageIndex < shuffledImages.length; i++) {
        userImages.push(shuffledImages[imageIndex]);
        imageIndex++;
      }
      
      userImageAssignments[user.id] = userImages;
    }
    
    // Second, add overlap images
    if (overlapCount > 0 && shuffledImages.length > maxImagesPerAdmin) {
      // Select overlap images from the remaining pool or reshuffle some images
      const overlapPool = imageIndex < shuffledImages.length 
        ? shuffledImages.slice(imageIndex, imageIndex + overlapCount * superAdminUsers.length)
        : shuffleArray(shuffledImages.slice(0, overlapCount * superAdminUsers.length));
      
      let overlapIndex = 0;
      for (let userIndex = 0; userIndex < superAdminUsers.length; userIndex++) {
        const user = superAdminUsers[userIndex];
        
        // Add overlap images to this user
        for (let i = 0; i < overlapCount && overlapIndex < overlapPool.length; i++) {
          userImageAssignments[user.id].push(overlapPool[overlapIndex]);
          overlapIndex++;
          
          // Reset index to create overlap (same images for multiple users)
          if (overlapIndex >= overlapPool.length) {
            overlapIndex = 0;
          }
        }
      }
    }
    
    // Create annotations for all assigned images
    for (let userIndex = 0; userIndex < superAdminUsers.length; userIndex++) {
      const user = superAdminUsers[userIndex];
      const task = userTasks[user.id];
      const assignedImages = userImageAssignments[user.id];
      
      if (!task) {
        request.log.warn(`No task found for user ${user.id}`);
        continue;
      }
      
      for (const image of assignedImages) {
        if (image && image.id && image.specimen) {
          annotations.push({
            annotationTaskId: task.id,
            annotatorId: user.id,
            specimenId: image.specimen.id,
            status: 'PENDING'
          });
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

    // Calculate total images assigned
    const totalImagesAssigned = Object.values(userImageAssignments)
      .reduce((total, images) => total + images.length, 0);
    
    return reply.send({
      message: 'Annotation tasks created successfully',
      tasksCreated: createdTasks.length,
      imagesAvailable: shuffledImages.length,
      totalImagesAssigned: totalImagesAssigned,
      maxImagesPerAdmin: maxImagesPerAdmin,
      overlapCount: overlapCount,
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
