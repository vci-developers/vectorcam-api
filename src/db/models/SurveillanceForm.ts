import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class SurveillanceForm extends Model {
    declare id: string;
    declare sessionId: string;
    declare collectionDate: Date | null;
    declare officerName: string | null;
    declare officerTitle: string | null;
    declare peopleInHouse: number | null;
    declare isBednetAvailable: boolean | null;
    declare numberOfBednetsAvailable: number | null;
    declare numberOfPeopleSleptUnderBednet: number | null;
    declare bednetType: string | null;
    declare bednetBrand: string | null;
    declare isIrsSprayed: boolean | null;
    declare irsDate: Date | null;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize SurveillanceForm model
  SurveillanceForm.init(
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
      collectionDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      officerName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      officerTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      peopleInHouse: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      isBednetAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      numberOfBednetsAvailable: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      numberOfPeopleSleptUnderBednet: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      bednetType: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      bednetBrand: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isIrsSprayed: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      irsDate: {
        type: DataTypes.DATEONLY,
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
      tableName: 'surveillanceforms',
      timestamps: true,
    }
  );

  return SurveillanceForm;
}; 