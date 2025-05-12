import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Imports for associations
import Site from './Site';
import Specimen from './Specimen';
import SurveillanceForm from './SurveillanceForm';

class Session extends Model {
  // Static association declarations will be created at runtime

  declare id: number;
  declare deviceId: number;
  declare siteId: number;
  declare createdAt: Date;
  declare submittedAt: Date;
  declare updatedAt: Date;
}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id',
      },
      field: 'site_id',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'submitted_at',
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