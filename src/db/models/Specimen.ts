import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Specimen extends Model {
    declare id: string;
    declare sessionId: string;
    declare yoloBoxId: string;
    declare imageUrl: string | null;
    declare species: string | null;
    declare sex: string | null;
    declare abdomenStatus: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize Specimen model
  Specimen.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      sessionId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
          model: 'sessions',
          key: 'id',
        },
      },
      yoloBoxId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
          model: 'yoloboxes',
          key: 'id',
        },
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      species: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      sex: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      abdomenStatus: {
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
      tableName: 'specimens',
      timestamps: true,
    }
  );

  return Specimen;
}; 