import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import User from './User';

class AnnotationTask extends Model {
  declare id: number;
  declare userId: number;
  declare title?: string;
  declare description?: string;
  declare status: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AnnotationTask.init(
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  },
  {
    sequelize,
    tableName: 'annotation_tasks',
    underscored: true,
    timestamps: true,
  }
);

User.hasMany(AnnotationTask, { foreignKey: 'user_id', as: 'annotationTasks' });
AnnotationTask.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export default AnnotationTask;
