import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Site from './Site';
import Program from './Program';

class LocationType extends Model {
  declare id: number;
  declare programId: number;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

LocationType.init(
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
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'location_types',
    underscored: true,
    timestamps: true,
  }
);

// Associations
LocationType.hasMany(Site, { foreignKey: 'location_type_id', as: 'sites' });
Site.belongsTo(LocationType, { foreignKey: 'location_type_id', as: 'locationType' });
LocationType.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(LocationType, { foreignKey: 'program_id', as: 'locationTypes' });

export default LocationType;


