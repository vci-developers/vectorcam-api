import { FastifyInstance } from 'fastify';
import { signResourceUrlHandler } from '../handlers/resource';
import { schema as signResourceUrlSchema } from '../handlers/resource/signUrl';
import { siteAccessMiddleware } from '../middleware/siteAccess.middleware';

export default function (fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook('preHandler', siteAccessMiddleware);

  fastify.post('/sign', {
    schema: signResourceUrlSchema,
  }, signResourceUrlHandler);

  done();
}
