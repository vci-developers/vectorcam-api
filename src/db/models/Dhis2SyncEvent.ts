import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Dhis2SyncEvent extends Model {
  declare id: number;
  declare programStageId: string;
  declare siteId: number;
  declare year: number;
  declare month: number;
  declare eventId: string;
  declare trackedEntityInstanceId: string;
  declare organizationUnitId: string;
  declare eventDate: string;
  declare lastSyncedAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Dhis2SyncEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    programStageId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'program_stage_id',
      comment: 'DHIS2 program stage ID to scope syncs',
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id',
      },
      field: 'site_id',
      comment: 'VectorCam site (household) ID',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Year of the data collection',
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Month of the data collection (1-12)',
    },
    eventId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'event_id',
      comment: 'DHIS2 event ID for this sync',
    },
    trackedEntityInstanceId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'tracked_entity_instance_id',
      comment: 'DHIS2 TEI ID for this household',
    },
    organizationUnitId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'organization_unit_id',
      comment: 'DHIS2 organization unit ID',
    },
    eventDate: {
      type: DataTypes.STRING(10), // Format: YYYY-MM-DD
      allowNull: false,
      field: 'event_date',
      comment: 'Event date in DHIS2 (YYYY-MM-DD)',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_synced_at',
      comment: 'Timestamp of the last successful sync',
    },
  },
  {
    sequelize,
    tableName: 'dhis2_sync_events',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['program_stage_id', 'site_id', 'year', 'month'],
        name: 'dhis2_sync_events_unique',
      },
      {
        fields: ['site_id'],
        name: 'dhis2_sync_events_site_id',
      },
      {
        fields: ['year', 'month'],
        name: 'dhis2_sync_events_year_month',
      },
      {
        fields: ['event_id'],
        name: 'dhis2_sync_events_event_id',
      },
    ],
  }
);

export default Dhis2SyncEvent;

