import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Program from './Program';

export const VECTOR_AI_INFERENCE_FIELDS = ['species', 'sex', 'abdomen_status'] as const;
export type VectorAiInferenceField = (typeof VECTOR_AI_INFERENCE_FIELDS)[number];

class VectorAiModel extends Model {
  declare id: number;
  declare programId: number;
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
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
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
        fields: ['program_id', 'field', 'version'],
      },
    ],
  }
);

VectorAiModel.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(VectorAiModel, { foreignKey: 'program_id', as: 'vectorAiModels' });

export default VectorAiModel;
