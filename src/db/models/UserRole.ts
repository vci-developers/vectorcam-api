import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Role from './Role';
import User from './User';
import type { AssignmentScope } from '../../services/permissions';

class UserRole extends Model {
  declare userId: number;
  declare roleId: number;
  declare scope: AssignmentScope;
  declare role?: Role;
  declare createdAt: Date;
  declare updatedAt: Date;
}

UserRole.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      field: 'user_id',
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'roles',
        key: 'id',
      },
      onDelete: 'CASCADE',
      field: 'role_id',
    },
    scope: {
      type: DataTypes.ENUM('program', 'assigned_sites'),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'user_roles',
    underscored: true,
    timestamps: true,
  }
);

UserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UserRole, { foreignKey: 'userId', as: 'roleAssignments' });
UserRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(UserRole, { foreignKey: 'roleId', as: 'assignments' });

export default UserRole;
