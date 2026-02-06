import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class User extends Model {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare privilege: number;
  declare programId: number | null;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    privilege: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
  }
);

export default User;
