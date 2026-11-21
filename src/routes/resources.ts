import { FastifyInstance } from 'fastify';
import { signResourceUrlHandler } from '../handlers/resource';
import { schema as signResourceUrlSchema } from '../handlers/resource/signUrl';

export default function (fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.post('/sign', {
    schema: signResourceUrlSchema,
  }, signResourceUrlHandler);

  done();
}
