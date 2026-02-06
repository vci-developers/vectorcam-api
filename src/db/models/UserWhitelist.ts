import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class UserWhitelist extends Model {
  declare id: number;
  declare email: string;
  declare programId: number;
}

UserWhitelist.init(
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
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
    },
  },
  {
    sequelize,
    tableName: 'user_whitelist',
    underscored: true,
    timestamps: false,
  }
);

export default UserWhitelist;
