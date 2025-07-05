import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

class SpecimenImage extends Model {
  declare id: number;
  declare specimenId: number;
  declare imageKey: string;
  declare filemd5: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SpecimenImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    specimenId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'specimens',
        key: 'id',
      },
      field: 'specimen_id',
    },
    imageKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'image_key',
    },
    filemd5: {
      type: DataTypes.STRING(32),
      allowNull: false,
    }
  },
  {
    sequelize,
    tableName: 'specimen_images',
    underscored: true,
    timestamps: true,
  }
);

export default SpecimenImage; 