import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import AnnotationTask from './AnnotationTask';
import Specimen from './Specimen';
import User from './User';

class Annotation extends Model {
  declare id: number;
  declare annotationTaskId: number;
  declare annotatorId: number;
  declare specimenId: number;
  declare morphSpecies?: string;
  declare morphSex?: string;
  declare morphAbdomenStatus?: string;
  declare notes?: string;
  declare status: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Annotation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    annotationTaskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'annotation_tasks',
        key: 'id',
      },
      field: 'annotation_task_id',
    },
    annotatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'annotator_id',
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
    morphSpecies: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'morph_species',
    },
    morphSex: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'morph_sex',
    },
    morphAbdomenStatus: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'morph_abdomen_status',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ANNOTATED', 'FLAGGED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  },
  {
    sequelize,
    tableName: 'annotations',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['annotation_task_id', 'specimen_id'],
        name: 'unique_task_specimen'
      }
    ]
  }
);

AnnotationTask.hasMany(Annotation, { foreignKey: 'annotation_task_id', as: 'annotations' });
Annotation.belongsTo(AnnotationTask, { foreignKey: 'annotation_task_id', as: 'annotationTask' });

Specimen.hasMany(Annotation, { foreignKey: 'specimen_id', as: 'annotations' });
Annotation.belongsTo(Specimen, { foreignKey: 'specimen_id', as: 'specimen' });

User.hasMany(Annotation, { foreignKey: 'annotator_id', as: 'annotations' });
Annotation.belongsTo(User, { foreignKey: 'annotator_id', as: 'annotator' });

export default Annotation;
