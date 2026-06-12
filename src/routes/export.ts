import { FastifyInstance } from 'fastify';
import { signExportUrlHandler } from '../handlers/export';
import { schema as signExportUrlSchema } from '../handlers/export/signUrl';
import { siteAccessMiddleware } from '../middleware/siteAccess.middleware';

export default function (fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook('preHandler', siteAccessMiddleware);

  fastify.post('/sign', {
    schema: signExportUrlSchema,
  }, signExportUrlHandler);

  done();
}
