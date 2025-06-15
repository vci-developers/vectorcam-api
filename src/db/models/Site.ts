import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Site extends Model {
  declare id: number;
  declare programId: number;
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
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
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