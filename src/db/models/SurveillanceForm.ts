import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class SurveillanceForm extends Model {
  declare id: number;
  declare sessionId: number;
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

SurveillanceForm.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'id',
      },
      field: 'session_id',
    },
    collectionDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'collection_date',
    },
    officerName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'officer_name',
    },
    officerTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'officer_title',
    },
    peopleInHouse: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'people_in_house',
    },
    isBednetAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'is_bednet_available',
    },
    numberOfBednetsAvailable: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'number_of_bednets_available',
    },
    numberOfPeopleSleptUnderBednet: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'number_of_people_slept_under_bednet',
    },
    bednetType: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'bednet_type',
    },
    bednetBrand: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'bednet_brand',
    },
    isIrsSprayed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'is_irs_sprayed',
    },
    irsDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'irs_date',
    },
  },
  {
    sequelize,
    tableName: 'surveillanceforms',
    underscored: true,
    timestamps: true,
  }
);

export default SurveillanceForm; 