import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

export type Dhis2SyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out';

class Dhis2SyncTask extends Model {
  declare id: string;
  declare status: Dhis2SyncTaskStatus;
  declare year: number | null;
  declare month: number | null;
  declare district: string | null;
  declare siteIds: number[] | null;
  declare collectionCycleId: number | null;
  declare siteId: number | null;
  declare dryRun: boolean;
  declare requestBody: Record<string, unknown> | null;
  declare requestedByUserId: number | null;
  declare requestedByAuthType: string | null;
  declare timeoutSeconds: number;
  declare startedAt: Date | null;
  declare finishedAt: Date | null;
  declare error: string | null;
  declare result: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Dhis2SyncTask.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'timed_out'),
      allowNull: false,
      defaultValue: 'pending',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    siteIds: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'site_ids',
    },
    collectionCycleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'collection_cycle_id',
      references: {
        model: 'collection_cycles',
        key: 'id',
      },
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'site_id',
      references: {
        model: 'sites',
        key: 'id',
      },
    },
    dryRun: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'dry_run',
    },
    requestBody: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'request_body',
    },
    requestedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'requested_by_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    requestedByAuthType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'requested_by_auth_type',
    },
    timeoutSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 300,
      field: 'timeout_seconds',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finished_at',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    result: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'dhis2_sync_tasks',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['status'],
        name: 'dhis2_sync_tasks_status',
      },
      {
        fields: ['year', 'month', 'district'],
        name: 'dhis2_sync_tasks_period_district',
      },
      {
        fields: ['collection_cycle_id', 'site_id'],
        name: 'dhis2_sync_tasks_cycle_site',
      },
      {
        fields: ['created_at'],
        name: 'dhis2_sync_tasks_created_at',
      },
    ],
  }
);

export default Dhis2SyncTask;
