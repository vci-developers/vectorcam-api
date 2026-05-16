import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Program from './Program';
import CollectionSchedule from './CollectionSchedule';

class CollectionCycle extends Model {
  declare id: number;
  declare programId: number;
  declare collectionScheduleId: number;
  declare cycleNumber: number;
  declare startDate: Date;
  declare endDate: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

CollectionCycle.init(
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
    collectionScheduleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'collection_schedules',
        key: 'id',
      },
      field: 'collection_schedule_id',
    },
    cycleNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'cycle_number',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date',
    },
  },
  {
    sequelize,
    tableName: 'collection_cycles',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['collection_schedule_id', 'cycle_number'],
      },
      {
        fields: ['program_id', 'start_date', 'end_date'],
      },
    ],
  }
);

CollectionCycle.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(CollectionCycle, { foreignKey: 'program_id', as: 'collectionCycles' });

CollectionCycle.belongsTo(CollectionSchedule, { foreignKey: 'collection_schedule_id', as: 'collectionSchedule' });
CollectionSchedule.hasMany(CollectionCycle, { foreignKey: 'collection_schedule_id', as: 'collectionCycles' });

export default CollectionCycle;
