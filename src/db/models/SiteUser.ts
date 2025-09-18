import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models for associations
import Site from './Site';
import User from './User';

class SiteUser extends Model {
  declare id: number;
  declare userId: number;
  declare siteId: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SiteUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'user_id',
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id',
      },
      field: 'site_id',
    },
  },
  {
    sequelize,
    tableName: 'site_users',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'site_id']
      }
    ]
  }
);

// Set up associations
SiteUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(SiteUser, { foreignKey: 'user_id', as: 'siteUsers' });

SiteUser.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Site.hasMany(SiteUser, { foreignKey: 'site_id', as: 'siteUsers' });

export default SiteUser;
