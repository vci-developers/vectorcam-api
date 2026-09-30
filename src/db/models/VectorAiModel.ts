import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

export const VECTOR_AI_INFERENCE_FIELDS = ['species', 'sex', 'abdomen_status'] as const;
export type VectorAiInferenceField = (typeof VECTOR_AI_INFERENCE_FIELDS)[number];

class VectorAiModel extends Model {
  declare id: number;
  declare field: VectorAiInferenceField;
  declare version: string;
  declare description: string | null;
  declare sagemakerEndpoint: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

VectorAiModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    field: {
      type: DataTypes.ENUM(...VECTOR_AI_INFERENCE_FIELDS),
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sagemakerEndpoint: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'sagemaker_endpoint',
    },
  },
  {
    sequelize,
    tableName: 'vector_ai_models',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['field', 'version'],
      },
    ],
  }
);

export default VectorAiModel;
