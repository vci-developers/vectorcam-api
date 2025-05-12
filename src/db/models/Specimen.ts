import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import YoloBox from './YoloBox';

class Specimen extends Model {
  declare id: number;
  declare specimenId: string;
  declare sessionId: number;
  declare yoloBoxId: number | null;
  declare imageUrl: string | null;
  declare species: string | null;
  declare sex: string | null;
  declare abdomenStatus: string | null;
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
    yoloBoxId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'yoloboxes',
        key: 'id',
      },
      field: 'yolo_box_id',
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: 'image_url',
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
  },
  {
    sequelize,
    tableName: 'specimens',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
Specimen.belongsTo(YoloBox, { foreignKey: 'yolo_box_id', as: 'yoloBox' });
YoloBox.hasOne(Specimen, { foreignKey: 'yolo_box_id', as: 'specimen' });

export default Specimen; 