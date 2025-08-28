import { User } from '../../db/models';

// User response format interface
export interface UserResponse {
  id: number;
  email: string;
  privilege: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Helper to format user data consistently across endpoints
export function formatUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    privilege: user.privilege,
    isActive: user.isActive,
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt.getTime(),
  };
}

// Check if user exists by ID
export async function findUserById(userId: number): Promise<User | null> {
  return await User.findByPk(userId);
}

// Check if user exists by email
export async function findUserByEmail(email: string): Promise<User | null> {
  return await User.findOne({ where: { email } });
}
