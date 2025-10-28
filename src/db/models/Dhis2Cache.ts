import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Dhis2Cache extends Model {
  declare id: number;
  declare programStageId: string;
  declare cacheType: 'orgUnit' | 'tei' | 'dataElementMap';
  declare cacheKey: string;
  declare cacheValue: string; // JSON stringified data
  declare createdAt: Date;
  declare updatedAt: Date;
}

Dhis2Cache.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    programStageId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'program_stage_id',
    },
    cacheType: {
      type: DataTypes.ENUM('orgUnit', 'tei', 'dataElementMap'),
      allowNull: false,
      field: 'cache_type',
    },
    cacheKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'cache_key',
    },
    cacheValue: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'cache_value',
    },
  },
  {
    sequelize,
    tableName: 'dhis2_cache',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['program_stage_id', 'cache_type', 'cache_key'],
      },
    ],
  }
);

export default Dhis2Cache;

