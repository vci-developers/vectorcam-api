import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Program from './Program';
import type RolePermission from './RolePermission';

class Role extends Model {
  declare id: number;
  declare key: string;
  declare name: string;
  declare programId: number | null;
  declare isSystem: boolean;
  declare permissions?: RolePermission[];
  declare createdAt: Date;
  declare updatedAt: Date;
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      onDelete: 'CASCADE',
      field: 'program_id',
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_system',
    },
  },
  {
    sequelize,
    tableName: 'roles',
    underscored: true,
    timestamps: true,
  }
);

Role.belongsTo(Program, { foreignKey: 'programId', as: 'program' });
Program.hasMany(Role, { foreignKey: 'programId', as: 'roles' });

export default Role;
