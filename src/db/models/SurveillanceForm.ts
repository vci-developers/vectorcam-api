import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class SurveillanceForm extends Model {
  declare id: number;
  declare sessionId: number;
  declare numPeopleSleptInHouse: number | null;
  declare wasIrsConducted: boolean | null;
  declare monthsSinceIrs: number | null;
  declare numLlinsAvailable: number | null;
  declare llinType: string | null;
  declare llinBrand: string | null;
  declare numPeopleSleptUnderLlin: number | null;
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
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    numPeopleSleptInHouse: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'num_people_slept_in_house',
    },
    wasIrsConducted: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'was_irs_conducted',
    },
    monthsSinceIrs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'months_since_irs',
    },
    numLlinsAvailable: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'num_llins_available',
    },
    llinType: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'llin_type',
    },
    llinBrand: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'llin_brand',
    },
    numPeopleSleptUnderLlin: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'num_people_slept_under_llin',
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