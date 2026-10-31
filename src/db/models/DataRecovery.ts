import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

/**
 * Unstructured landing zone for uploads that could not be written to
 * the normal tables. Correlation columns are optional and have no
 * foreign keys so a payload can be stored before it can be reconciled.
 */
class DataRecovery extends Model {
  declare id: number;
  declare idempotencyKey: string;
  declare programId: number | null;
  declare siteId: number | null;
  declare sessionFrontendId: string | null;
  declare year: number | null;
  declare month: number | null;
  declare status: string;
  declare notes: string | null;
  declare payload: unknown;
  declare createdAt: Date;
  declare updatedAt: Date;
}

DataRecovery.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'program_id',
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'site_id',
    },
    sessionFrontendId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'session_frontend_id',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'pending',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'data_recoveries',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['program_id', 'year', 'month'] },
      { fields: ['site_id'] },
      { fields: ['status'] },
      { fields: ['session_frontend_id'] },
    ],
  }
);

export default DataRecovery;
