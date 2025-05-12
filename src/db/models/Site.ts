import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Site extends Model {
    declare id: string;
    declare healthCenterId: string;
    declare latitude: number | null;
    declare longitude: number | null;
    declare houseNumber: number | null;
    declare villageName: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize Site model
  Site.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      healthCenterId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
          model: 'healthcenters',
          key: 'id',
        },
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
      },
      villageName: {
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
      tableName: 'sites',
      timestamps: true,
    }
  );

  return Site;
}; 