import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

import Program from './Program';

class Workflow extends Model {
  declare id: number;
  declare programId: number;
  declare name: string;
  declare schema: Record<string, unknown>;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Workflow.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    schema: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'workflows',
    underscored: true,
    timestamps: true,
  }
);

Workflow.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasOne(Workflow, { foreignKey: 'program_id', as: 'workflow' });

export default Workflow;
