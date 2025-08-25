import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class UserWhitelist extends Model {
  declare id: number;
  declare email: string;
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
  },
  {
    sequelize,
    tableName: 'user_whitelist',
    underscored: true,
    timestamps: false,
  }
);

export default UserWhitelist;
