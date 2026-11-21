import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Role from './Role';

class RolePermission extends Model {
  declare roleId: number;
  declare permission: string;
}

RolePermission.init(
  {
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
    permission: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    underscored: true,
    timestamps: false,
  }
);

Role.hasMany(RolePermission, { foreignKey: 'roleId', as: 'permissions' });
RolePermission.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

export default RolePermission;
