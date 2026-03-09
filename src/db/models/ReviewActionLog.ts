import { DataTypes, Model } from 'sequelize';
import sequelize from '../index';

class ReviewActionLog extends Model {
  declare id: number;
  declare siteId: number;
  declare year: number;
  declare month: number;
  declare action: string;
  declare userId: number | null;
  declare hasChanges: boolean;
  declare changes: Record<string, unknown> | null;
  declare fields: Record<string, unknown> | null;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ReviewActionLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'site_id',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12,
      },
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
    },
    hasChanges: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_changes',
    },
    changes: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    fields: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'review_action_logs',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['site_id', 'year', 'month'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default ReviewActionLog;
