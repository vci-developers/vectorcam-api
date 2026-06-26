import { DataTypes, Model } from 'sequelize';
import sequelize from '../index';

export enum UserAuthEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  SIGNUP = 'signup',
  TOKEN_REFRESH = 'token_refresh',
}

class UserAuthEvent extends Model {
  declare id: number;
  declare userId: number;
  declare eventType: UserAuthEventType;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

UserAuthEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    eventType: {
      type: DataTypes.ENUM(...Object.values(UserAuthEventType)),
      allowNull: false,
      field: 'event_type',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: 'user_agent',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user_auth_events',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['event_type'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'created_at'] },
    ],
  }
);

export default UserAuthEvent;
