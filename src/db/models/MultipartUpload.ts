import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class MultipartUpload extends Model {
  declare id: number;
  declare specimenId: number;
  declare status: 'pending' | 'in_progress' | 'completed' | 'failed';
  declare currentPart: number;
  declare s3PartNumber: number;
  declare totalParts: number;
  declare bufferSize: number;
  declare bufferData: Buffer | null;
  declare s3UploadId: string;
  declare s3Key: string;
  declare s3PartEtags: string[];
  declare filemd5: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

MultipartUpload.init(
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
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    currentPart: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    s3PartNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 's3_part_number',
    },
    totalParts: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    bufferSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bufferData: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'buffer_data',
    },
    s3UploadId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    s3Key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    s3PartEtags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 's3_part_etags',
    },
    filemd5: {
      type: DataTypes.STRING(32),
      allowNull: false,
    }
  },
  {
    sequelize,
    tableName: 'multipart_uploads',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['specimen_id', 'filemd5']
      }
    ]
  }
);

export default MultipartUpload; 