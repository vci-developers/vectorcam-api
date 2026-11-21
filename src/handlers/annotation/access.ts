import { FastifyRequest } from 'fastify';
import { User } from '../../db/models';
import { AccessContext } from '../../services/accessContext';

/**
 * Annotation tasks carry no program, so a program-wide caller sees the tasks assigned to
 * users of their program. Each function returns the IDs of users whose tasks the caller
 * may touch; null means every task.
 */
async function programTaskOwnerIds(access: AccessContext): Promise<number[] | null> {
  if (access.allPrograms) {
    return null;
  }
  if (access.programId === null) {
    return [];
  }
  const users = await User.findAll({ where: { programId: access.programId }, attributes: ['id'] });
  return users.map((user) => user.id);
}

function ownTaskOwnerIds(request: FastifyRequest): number[] {
  return request.user ? [request.user.id] : [];
}

/**
 * Task and annotation lists. Annotators get their own work queue even when they can also
 * read the rest of the program; callers without a user (admin token) never have one.
 */
export async function listableTaskOwnerIds(request: FastifyRequest): Promise<number[] | null> {
  const { access } = request;
  if (access.has('annotation:annotate') && request.user) {
    return ownTaskOwnerIds(request);
  }
  if (access.hasAny(['annotation:read', 'annotation:manage'])) {
    return programTaskOwnerIds(access);
  }
  return [];
}

/** A single task or annotation. */
export async function viewableTaskOwnerIds(request: FastifyRequest): Promise<number[] | null> {
  const { access } = request;
  if (access.hasAny(['annotation:read', 'annotation:manage'])) {
    return programTaskOwnerIds(access);
  }
  if (access.has('annotation:annotate')) {
    return ownTaskOwnerIds(request);
  }
  return [];
}

/** Tasks whose every field, and whose annotations, the caller may change. */
export async function managedTaskOwnerIds(request: FastifyRequest): Promise<number[] | null> {
  if (request.access.has('annotation:manage')) {
    return programTaskOwnerIds(request.access);
  }
  return [];
}

export function canAccessTaskOwner(ownerIds: number[] | null, userId: number): boolean {
  return ownerIds === null || ownerIds.includes(userId);
}
