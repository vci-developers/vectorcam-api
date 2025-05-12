import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Site extends Model {
  declare id: number;
  declare healthCenterId: number;
  declare latitude: number | null;
  declare longitude: number | null;
  declare houseNumber: number | null;
  declare villageName: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Site.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    healthCenterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'healthcenters',
        key: 'id',
      },
      field: 'health_center_id',
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    houseNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'house_number',
    },
    villageName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'village_name',
    },
  },
  {
    sequelize,
    tableName: 'sites',
    underscored: true,
    timestamps: true,
  }
);

export default Site; 