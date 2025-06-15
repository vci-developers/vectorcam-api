import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import InferenceResult from './InferenceResult';
import SpecimenImage from './SpecimenImage';

class Specimen extends Model {
  declare id: number;
  declare specimenId: string;
  declare sessionId: number;
  declare thumbnailImageId: number | null;
  declare species: string | null;
  declare sex: string | null;
  declare abdomenStatus: string | null;
  declare capturedAt: Date | null;
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
      unique: true,
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
    species: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sex: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    abdomenStatus: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'abdomen_status',
    },
    capturedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'captured_at',
    },
  },
  {
    sequelize,
    tableName: 'specimens',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
Specimen.hasOne(InferenceResult, { foreignKey: 'specimenId', as: 'inferenceResult' });
InferenceResult.belongsTo(Specimen, { foreignKey: 'specimenId', as: 'specimen' });

// Setup associations with SpecimenImage
Specimen.belongsTo(SpecimenImage, { foreignKey: 'thumbnail_image_id', as: 'thumbnailImage' });
Specimen.hasMany(SpecimenImage, { foreignKey: 'specimen_id', as: 'images' });
SpecimenImage.belongsTo(Specimen, { foreignKey: 'specimen_id', as: 'specimen' });

export default Specimen; 