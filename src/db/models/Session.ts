import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Imports for associations
import Site from './Site';
import Specimen from './Specimen';
import SurveillanceForm from './SurveillanceForm';
import Device from './Device';

class Session extends Model {
  // Static association declarations will be created at runtime

  declare id: number;
  declare frontendId: string;
  declare collectorTitle: string | null;
  declare collectorName: string | null;
  declare collectionDate: Date | null;
  declare collectionMethod: string | null;
  declare specimenCondition: string | null;
  declare createdAt: Date;
  declare completedAt: Date | null;
  declare submittedAt: Date;
  declare notes: string | null;
  declare siteId: number;
  declare deviceId: number;
  declare updatedAt: Date;
  declare latitude: number | null;
  declare longitude: number | null;
  declare type: string;
  declare collectorLastTrainedOn: Date | null;
}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    frontendId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'frontend_id',
    },
    collectorTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'collector_title',
    },
    collectorName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'collector_name',
    },
    collectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'collection_date',
    },
    collectionMethod: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'collection_method',
    },
    specimenCondition: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'specimen_condition',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'submitted_at',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id',
      },
      field: 'site_id',
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'devices',
        key: 'id',
      },
      field: 'device_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'created_at',
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'longitude',
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'latitude',
    },
    type: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    collectorLastTrainedOn: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'collector_last_trained_on',
    },
  },
  {
    sequelize,
    tableName: 'sessions',
    underscored: true,
    timestamps: true,
    createdAt: false,
  }
);

// Set up associations
Session.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Site.hasMany(Session, { foreignKey: 'site_id', as: 'sessions' });

Session.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });
Device.hasMany(Session, { foreignKey: 'device_id', as: 'sessions' });

Session.hasMany(Specimen, { foreignKey: 'session_id', as: 'specimens' });
Specimen.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });

Session.hasOne(SurveillanceForm, { foreignKey: 'session_id', as: 'surveillanceForm' });
SurveillanceForm.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });

export default Session; 