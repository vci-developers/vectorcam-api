import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Program from './Program';

class ProgramModel extends Model {
  declare id: number;
  declare programId: number;
  declare version: string;
  declare s3Key: string;
  declare modelClasses: string[];
  declare fileSize: number;
  declare fileMd5: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProgramModel.init(
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
    version: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    s3Key: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 's3_key',
    },
    modelClasses: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'model_classes',
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size',
    },
    fileMd5: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'file_md5',
    },
  },
  {
    sequelize,
    tableName: 'program_models',
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

ProgramModel.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(ProgramModel, { foreignKey: 'program_id', as: 'models' });

export default ProgramModel;
