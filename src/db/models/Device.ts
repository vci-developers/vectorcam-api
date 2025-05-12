import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Site from './Site';
import Session from './Session';

class Device extends Model {
  declare id: number;
  declare siteId: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Device.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    tableName: 'devices',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
Device.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Site.hasMany(Device, { foreignKey: 'site_id', as: 'devices' });

Device.hasMany(Session, { foreignKey: 'device_id', as: 'sessions' });
Session.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

export default Device; 