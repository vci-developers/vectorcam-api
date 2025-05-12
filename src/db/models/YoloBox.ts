import { Model, DataTypes, Sequelize } from 'sequelize';
import sequelize from '../index';

// Class-based model with type annotations
class YoloBox extends Model {
  // Instance properties with type annotations
  declare id: number;
  declare topLeftX: number;
  declare topLeftY: number;
  declare width: number;
  declare height: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

YoloBox.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    topLeftX: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'top_left_x',
    },
    topLeftY: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'top_left_y',
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: 'yoloboxes',
    underscored: true,
    timestamps: true,
  }
);

export default YoloBox; 