import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

import Program from './Program';
import Form from './Form';

class ProgramForm extends Model {
  declare id: number;
  declare programId: number;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProgramForm.init(
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
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'program_forms',
    underscored: true,
    timestamps: true,
  }
);

ProgramForm.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(ProgramForm, { foreignKey: 'program_id', as: 'programForms' });

ProgramForm.hasMany(Form, { foreignKey: 'program_form_id', as: 'versions' });
Form.belongsTo(ProgramForm, { foreignKey: 'program_form_id', as: 'programForm' });

Program.belongsTo(ProgramForm, {
  foreignKey: 'default_program_form_id',
  as: 'defaultProgramForm',
});

export default ProgramForm;
