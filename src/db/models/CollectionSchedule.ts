import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Program from './Program';

export enum CollectionScheduleCadenceType {
  RECURRING = 'RECURRING',
  MANUAL = 'MANUAL',
}

export enum CollectionScheduleIntervalUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

class CollectionSchedule extends Model {
  declare id: number;
  declare programId: number;
  declare cadenceType: CollectionScheduleCadenceType;
  declare intervalUnit: CollectionScheduleIntervalUnit | null;
  declare intervalCount: number | null;
  declare effectiveStartDate: Date;
  declare effectiveEndDate: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

CollectionSchedule.init(
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
    cadenceType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'cadence_type',
    },
    intervalUnit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'interval_unit',
    },
    intervalCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'interval_count',
    },
    effectiveStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'effective_start_date',
    },
    effectiveEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'effective_end_date',
    },
  },
  {
    sequelize,
    tableName: 'collection_schedules',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['program_id', 'effective_start_date'],
      },
      {
        fields: ['program_id', 'effective_end_date'],
      },
    ],
  }
);

CollectionSchedule.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(CollectionSchedule, { foreignKey: 'program_id', as: 'collectionSchedules' });

export default CollectionSchedule;
