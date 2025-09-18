import { FastifyInstance } from 'fastify';
import { 
  signupHandler, signupSchema,
  loginHandler, loginSchema,
  refreshTokenHandler, refreshTokenSchema
} from '../handlers/auth';

/**
 * Authentication routes
 */
export default async function authRoutes(server: FastifyInstance): Promise<void> {
  // User signup
  server.post('/signup', { schema: signupSchema }, signupHandler);

  // User login
  server.post('/login', { schema: loginSchema }, loginHandler);

  // Refresh token
  server.post('/refresh', { schema: refreshTokenSchema }, refreshTokenHandler);
}
