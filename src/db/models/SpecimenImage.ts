import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import InferenceResult from './InferenceResult';

class SpecimenImage extends Model {
  declare id: number;
  declare specimenId: number;
  declare imageKey: string;
  declare filemd5: string;
  declare species: string | null;
  declare sex: string | null;
  declare abdomenStatus: string | null;
  declare capturedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SpecimenImage.init(
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
    imageKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'image_key',
    },
    filemd5: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    species: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sex: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    abdomenStatus: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'abdomen_status',
    },
    capturedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'captured_at',
    },
  },
  {
    sequelize,
    tableName: 'specimen_images',
    underscored: true,
    timestamps: true,
  }
);

SpecimenImage.hasOne(InferenceResult, { foreignKey: 'specimenImageId', as: 'inferenceResult' });
InferenceResult.belongsTo(SpecimenImage, { foreignKey: 'specimenImageId', as: 'specimenImage' });

export default SpecimenImage; 