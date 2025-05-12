import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Site from './Site';

class HealthCenter extends Model {
  declare id: number;
  declare latitude: number | null;
  declare longitude: number | null;
  declare parish: string | null;
  declare subcounty: string | null;
  declare district: string | null;
  declare country: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

HealthCenter.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    parish: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subcounty: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'healthcenters',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
HealthCenter.hasMany(Site, { foreignKey: 'health_center_id', as: 'sites' });
Site.belongsTo(HealthCenter, { foreignKey: 'health_center_id', as: 'healthCenter' });

export default HealthCenter; 