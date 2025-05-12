import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class HealthCenter extends Model {
    declare id: string;
    declare latitude: number;
    declare longitude: number;
    declare parish: string;
    declare subcounty: string;
    declare district: string;
    declare country: string;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize HealthCenter model
  HealthCenter.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'healthcenters',
      timestamps: true,
    }
  );

  return HealthCenter;
}; 