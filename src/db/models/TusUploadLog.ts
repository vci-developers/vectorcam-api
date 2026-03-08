import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

export type TusUploadStatus = 'created' | 'in_progress' | 'completed' | 'failed';
export interface TusUploadPartRecord {
  partNumber: number;
  partSize: number | null;
  uploadOffset: number | null;
  uploadedAt: string;
}

class TusUploadLog extends Model {
  declare id: number;
  declare specimenId: number;
  declare tusUploadId: string;
  declare status: TusUploadStatus;
  declare requestedImageRef: string | null;
  declare imageId: number | null;
  declare uploadLength: number | null;
  declare uploadCreatedAt: Date | null;
  declare uploadStartedAt: Date | null;
  declare uploadFinishedAt: Date | null;
  declare failureReason: string | null;
  declare s3Path: string | null;
  declare metadata: Record<string, unknown> | null;
  declare parts: TusUploadPartRecord[];
  declare createdAt: Date;
  declare updatedAt: Date;
}

TusUploadLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    specimenId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'specimens',
        key: 'id',
      },
      field: 'specimen_id',
    },
    tusUploadId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'tus_upload_id',
    },
    status: {
      type: DataTypes.ENUM('created', 'in_progress', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'created',
    },
    requestedImageRef: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'requested_image_ref',
    },
    imageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'image_id',
      references: {
        model: 'specimen_images',
        key: 'id',
      },
    },
    uploadLength: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'upload_length',
    },
    uploadCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'upload_created_at',
    },
    uploadStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'upload_started_at',
    },
    uploadFinishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'upload_finished_at',
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_reason',
    },
    s3Path: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 's3_path',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    parts: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize,
    tableName: 'tus_upload_logs',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['specimen_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['image_id'],
      },
      {
        fields: ['upload_created_at'],
      },
    ],
  }
);

export default TusUploadLog;
