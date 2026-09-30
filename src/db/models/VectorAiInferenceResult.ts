import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import VectorAiModel from './VectorAiModel';

export type VectorAiInferenceResultLog = Record<string, unknown>;

class VectorAiInferenceResult extends Model {
  declare id: number;
  declare specimenImageId: number;
  declare vectorAiModelId: number;
  declare value: string | null;
  declare resultLog: VectorAiInferenceResultLog | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

VectorAiInferenceResult.init(
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
    vectorAiModelId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vector_ai_models',
        key: 'id',
      },
      field: 'vector_ai_model_id',
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    resultLog: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'result_log',
    },
  },
  {
    sequelize,
    tableName: 'vector_ai_inference_results',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['specimen_image_id', 'vector_ai_model_id'],
        name: 'vector_ai_inference_results_image_model_unique',
      },
      {
        fields: ['specimen_image_id'],
      },
      {
        fields: ['vector_ai_model_id'],
      },
    ],
  }
);

VectorAiModel.hasMany(VectorAiInferenceResult, {
  foreignKey: 'vectorAiModelId',
  as: 'inferenceResults',
});
VectorAiInferenceResult.belongsTo(VectorAiModel, {
  foreignKey: 'vectorAiModelId',
  as: 'vectorAiModel',
});

export default VectorAiInferenceResult;
