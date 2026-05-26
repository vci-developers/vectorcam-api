import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Form from './Form';

class FormQuestion extends Model {
  declare id: number;
  declare formId: number;
  declare parentId: number | null;
  declare prerequisite: unknown | null;
  declare label: string;
  declare type: string;
  declare required: boolean;
  declare options: unknown[] | null;
  declare order: number | null;
  declare answerScope: 'SESSION' | 'SESSION_UNIT';
  declare isUnitIdentityComponent: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

FormQuestion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    formId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'forms',
        key: 'id',
      },
      field: 'form_id',
      onDelete: 'CASCADE',
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'form_questions',
        key: 'id',
      },
      field: 'parent_id',
      onDelete: 'CASCADE',
    },
    prerequisite: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    label: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    answerScope: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'SESSION',
      field: 'answer_scope',
      validate: {
        isIn: [['SESSION', 'SESSION_UNIT']],
      },
    },
    isUnitIdentityComponent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_unit_identity_component',
    },
  },
  {
    sequelize,
    tableName: 'form_questions',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
FormQuestion.belongsTo(Form, { foreignKey: 'form_id', as: 'form' });
Form.hasMany(FormQuestion, { foreignKey: 'form_id', as: 'questions' });

FormQuestion.belongsTo(FormQuestion, { foreignKey: 'parent_id', as: 'parent' });
FormQuestion.hasMany(FormQuestion, { foreignKey: 'parent_id', as: 'children' });

export default FormQuestion;

