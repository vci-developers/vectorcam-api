import { Model, DataTypes, Sequelize } from 'sequelize';
import sequelize from '../index';

// Class-based model with type annotations
class InferenceResult extends Model {
  // Instance properties with type annotations
  declare id: number;
  declare specimenImageId: number;
  declare bboxTopLeftX: number;
  declare bboxTopLeftY: number;
  declare bboxWidth: number;
  declare bboxHeight: number;
  declare speciesLogits: string;
  declare sexLogits: string;
  declare abdomenStatusLogits: string;
  declare bboxConfidence: number;
  declare bboxClassId: number;
  declare speciesInferenceDuration: number;
  declare sexInferenceDuration: number;
  declare abdomenStatusInferenceDuration: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

InferenceResult.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    specimenImageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'specimen_images',
        key: 'id',
      },
      field: 'specimen_image_id',
    },
    bboxTopLeftX: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'bbox_top_left_x',
    },
    bboxTopLeftY: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'bbox_top_left_y',
    },
    bboxWidth: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'bbox_width',
    },
    bboxHeight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'bbox_height',
    },
    speciesLogits: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'species_logits',
    },
    sexLogits: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'sex_logits',
    },
    abdomenStatusLogits: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'abdomen_status_logits',
    },
    bboxConfidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'bbox_confidence',
    },
    bboxClassId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'bbox_class_id',
    },
    speciesInferenceDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'species_inference_duration',
    },
    sexInferenceDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sex_inference_duration',
    },
    abdomenStatusInferenceDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'abdomen_status_inference_duration',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'inference_results',
    underscored: true,
    timestamps: true,
  }
);

export default InferenceResult; 