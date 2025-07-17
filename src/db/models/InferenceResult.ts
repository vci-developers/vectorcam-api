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
  declare speciesProbabilities: string;
  declare sexProbabilities: string;
  declare abdomenStatusProbabilities: string;
  declare bboxConfidence: number;
  declare bboxClassId: number;
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
    speciesProbabilities: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'species_probabilities',
    },
    sexProbabilities: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'sex_probabilities',
    },
    abdomenStatusProbabilities: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'abdomen_status_probabilities',
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