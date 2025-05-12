import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class YoloBox extends Model {
    declare id: string;
    declare topLeftX: number;
    declare topLeftY: number;
    declare width: number;
    declare height: number;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  // Initialize YoloBox model
  YoloBox.init(
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      topLeftX: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      topLeftY: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      timestamps: true,
    }
  );

  return YoloBox;
}; 