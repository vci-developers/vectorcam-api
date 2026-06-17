import { FastifyInstance } from 'fastify';
import { 
  signupHandler, signupSchema,
  loginHandler, loginSchema,
  refreshTokenHandler, refreshTokenSchema,
  forgotPasswordHandler, forgotPasswordSchema,
  resetPasswordWithTokenHandler, resetPasswordWithTokenSchema,
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

  // Request password reset (verified users only)
  server.post('/forgot-password', { schema: forgotPasswordSchema }, forgotPasswordHandler);

  // Reset password with email token
  server.post('/reset-password', { schema: resetPasswordWithTokenSchema }, resetPasswordWithTokenHandler);
}
