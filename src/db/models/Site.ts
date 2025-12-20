import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class Site extends Model {
  declare id: number;
  declare programId: number;
  declare locationTypeId: number | null;
  declare parentId: number | null;
  declare name: string | null;
  declare locationHierarchy: Record<string, string> | null;
  declare district: string | null;
  declare subCounty: string | null;
  declare parish: string | null;
  declare villageName: string | null;
  declare houseNumber: string;
  declare isActive: boolean;
  declare hasData: boolean;
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
    locationTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'location_types',
        key: 'id',
      },
      field: 'location_type_id',
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'sites',
        key: 'id',
      },
      field: 'parent_id',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    locationHierarchy: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'location_hierarchy',
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
    villageName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'village_name',
    },
    houseNumber: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'house_number',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    hasData: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_data',
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

// Self-referencing associations for hierarchical relationships
Site.belongsTo(Site, { foreignKey: 'parent_id', as: 'parent' });
Site.hasMany(Site, { foreignKey: 'parent_id', as: 'children' });

export default Site; 