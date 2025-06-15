import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Site extends Model {
  declare id: number;
  declare programId: number;
  declare district: string | null;
  declare subCounty: string | null;
  declare parish: string | null;
  declare sentinelSite: string | null;
  declare healthCenter: string | null;
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
    district: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subCounty: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'sub_county',
    },
    parish: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sentinelSite: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'sentinel_site',
    },
    healthCenter: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'health_center',
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