import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Session from './Session';
import Form from './Form';
import FormQuestion from './FormQuestion';

class FormAnswer extends Model {
  declare id: number;
  declare sessionId: number;
  declare formId: number;
  declare questionId: number;
  declare value: unknown;
  declare dataType: string;
  declare submittedAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

FormAnswer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'id',
      },
      field: 'session_id',
      onDelete: 'CASCADE',
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
    questionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'form_questions',
        key: 'id',
      },
      field: 'question_id',
      onDelete: 'CASCADE',
    },
    value: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    dataType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'text',
      field: 'data_type',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'submitted_at',
    },
  },
  {
    sequelize,
    tableName: 'form_answers',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['session_id', 'form_id', 'question_id'],
      },
      {
        fields: ['submitted_at'],
      },
    ],
  }
);

// Setup associations
FormAnswer.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
Session.hasMany(FormAnswer, { foreignKey: 'session_id', as: 'formAnswers' });

FormAnswer.belongsTo(Form, { foreignKey: 'form_id', as: 'form' });
Form.hasMany(FormAnswer, { foreignKey: 'form_id', as: 'answers' });

FormAnswer.belongsTo(FormQuestion, { foreignKey: 'question_id', as: 'question' });
FormQuestion.hasMany(FormAnswer, { foreignKey: 'question_id', as: 'answers' });

export default FormAnswer;

