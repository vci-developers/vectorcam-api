import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Session extends Model {
    declare id: string;
    declare deviceId: string;
    declare siteId: string;
    declare createdAt: Date;
    declare submittedAt: Date | null;
    declare updatedAt: Date;
  }

  // Initialize Session model
  Session.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      deviceId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
          model: 'devices',
          key: 'id',
        },
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
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'sessions',
      timestamps: true,
    }
  );

  return Session;
}; 