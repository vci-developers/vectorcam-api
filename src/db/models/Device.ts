import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Device extends Model {
    declare id: string;
    declare siteId: string;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize Device model
  Device.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      siteId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
          model: 'sites',
          key: 'id',
        },
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
      tableName: 'devices',
      timestamps: true,
    }
  );

  return Device;
}; 