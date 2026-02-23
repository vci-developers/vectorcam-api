import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import SpecimenImage from './SpecimenImage';

class Specimen extends Model {
  declare id: number;
  declare specimenId: string;
  declare sessionId: number;
  declare thumbnailImageId: number | null;
  declare shouldProcessFurther: boolean;
  declare totalImages: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Specimen.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    specimenId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'id',
      },
      field: 'session_id',
    },
    thumbnailImageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: 'thumbnail_image_id',
      references: {
        model: 'specimen_images',
        key: 'id',
      },
    },
    shouldProcessFurther: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'should_process_further',
    },
    totalImages: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_images',
    },
  },
  {
    sequelize,
    tableName: 'specimens',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['session_id', 'specimen_id']
      }
    ]
  }
);

// Setup associations with SpecimenImage
Specimen.belongsTo(SpecimenImage, { foreignKey: 'thumbnail_image_id', as: 'thumbnailImage' });
Specimen.hasMany(SpecimenImage, { foreignKey: 'specimen_id', as: 'images' });
SpecimenImage.belongsTo(Specimen, { foreignKey: 'specimen_id', as: 'specimen' });

export default Specimen; 