import { FastifyInstance } from 'fastify';
import { 
  signupHandler, signupSchema,
  loginHandler, loginSchema,
  refreshTokenHandler, refreshTokenSchema,
  logoutHandler, logoutSchema,
  forgotPasswordHandler, forgotPasswordSchema,
  resetPasswordWithTokenHandler, resetPasswordWithTokenSchema,
} from '../handlers/auth';
import { requireNonWhitelistedUserAuth } from '../middleware/auth.middleware';

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

  // Logout (records audit event; JWT remains valid until expiry)
  server.post('/logout', { schema: logoutSchema, preHandler: requireNonWhitelistedUserAuth }, logoutHandler);

  // Request password reset (verified users only)
  server.post('/forgot-password', { schema: forgotPasswordSchema }, forgotPasswordHandler);

  // Reset password with email token
  server.post('/reset-password', { schema: resetPasswordWithTokenSchema }, resetPasswordWithTokenHandler);
}
