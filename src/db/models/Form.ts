import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Program from './Program';

class Form extends Model {
  declare id: number;
  declare programId: number;
  declare name: string;
  declare version: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Form.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: '',
    },
  },
  {
    sequelize,
    tableName: 'forms',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['program_id', 'version'],
      },
    ],
  }
);

// Setup associations
Form.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(Form, { foreignKey: 'program_id', as: 'forms' });

export default Form;

