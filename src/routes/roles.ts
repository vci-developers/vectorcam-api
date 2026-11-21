import { FastifyInstance } from 'fastify';
import { createRole, deleteRole, getRoleList, updateRole } from '../handlers/role';
import { schema as getListSchema } from '../handlers/role/getList';
import { schema as createSchema } from '../handlers/role/post';
import { schema as updateSchema } from '../handlers/role/put';
import { schema as deleteSchema } from '../handlers/role/delete';
import { requirePermission } from '../middleware/permission.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  fastify.addHook('preHandler', requirePermission('system:admin'));

  fastify.get('/', { schema: getListSchema }, getRoleList as any);
  fastify.post('/', { schema: createSchema }, createRole as any);
  fastify.put('/:role_id', { schema: updateSchema }, updateRole as any);
  fastify.delete('/:role_id', { schema: deleteSchema }, deleteRole as any);

  done();
}
