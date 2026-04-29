import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Site from './Site';

class Program extends Model {
  declare id: number;
  declare name: string;
  declare country: string;
  declare accessCode: string;
  declare formVersion: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Program.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    accessCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      field: 'access_code',
    },
    formVersion: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'form_version',
    },
  },
  {
    sequelize,
    tableName: 'programs',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
Program.hasMany(Site, { foreignKey: 'program_id', as: 'sites' });
Site.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });

export default Program; 