import { AnnotationTask, User } from '../../db/models';
import { formatUserResponse, UserResponse } from '../user/common';

// Annotation Task response format interface
export interface AnnotationTaskResponse {
  id: number;
  userId: number;
  title: string | null;
  description: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  user?: UserResponse;
}

// Helper to format annotation task data consistently across endpoints
export function formatAnnotationTaskResponse(task: AnnotationTask, includeUser: boolean = false): AnnotationTaskResponse {
  const response: AnnotationTaskResponse = {
    id: task.id,
    userId: task.userId,
    title: task.title || null,
    description: task.description || null,
    status: task.status,
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
  };

  // Include user data if requested and available
  if (includeUser && task.get('user')) {
    response.user = formatUserResponse(task.get('user') as User);
  }

  return response;
}

// Check if annotation task exists by ID
export async function findAnnotationTaskById(taskId: number): Promise<AnnotationTask | null> {
  return await AnnotationTask.findByPk(taskId);
}

// Check if annotation task exists by ID with user
export async function findAnnotationTaskWithUser(taskId: number): Promise<AnnotationTask | null> {
  return await AnnotationTask.findByPk(taskId, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'privilege', 'isActive', 'createdAt', 'updatedAt']
      }
    ]
  });
}

// Check if user owns annotation task
export async function isTaskOwner(taskId: number, userId: number): Promise<boolean> {
  const task = await AnnotationTask.findOne({
    where: { id: taskId, userId }
  });
  return !!task;
}
