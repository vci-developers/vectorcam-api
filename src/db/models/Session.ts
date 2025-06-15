import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Imports for associations
import Site from './Site';
import Specimen from './Specimen';
import SurveillanceForm from './SurveillanceForm';

class Session extends Model {
  // Static association declarations will be created at runtime

  declare id: number;
  declare frontendId: number;
  declare houseNumber: string | null;
  declare collectorTitle: string | null;
  declare collectorName: string | null;
  declare collectionDate: Date | null;
  declare collectionMethod: string | null;
  declare specimenCondition: string | null;
  declare createdAt: Date;
  declare completedAt: Date | null;
  declare submittedAt: Date | null;
  declare notes: string | null;
  declare siteId: number;
  declare updatedAt: Date;
}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    frontendId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'frontend_id',
    },
    houseNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'house_number',
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
      allowNull: true,
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
  },
  {
    sequelize,
    tableName: 'sessions',
    underscored: true,
    timestamps: true,
  }
);

// Set up associations
Session.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Site.hasMany(Session, { foreignKey: 'site_id', as: 'sessions' });

Session.hasMany(Specimen, { foreignKey: 'session_id', as: 'specimens' });
Specimen.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });

Session.hasOne(SurveillanceForm, { foreignKey: 'session_id', as: 'surveillanceForm' });
SurveillanceForm.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });

export default Session; 