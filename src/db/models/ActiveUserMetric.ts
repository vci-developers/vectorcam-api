import { DataTypes, Model } from 'sequelize';
import sequelize from '../index';

class ActiveUserMetric extends Model {
  declare id: number;
  declare snapshotDate: Date;
  declare programId: number | null;
  declare a1Count: number;
  declare a7Count: number;
  declare a30Count: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ActiveUserMetric.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    snapshotDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'snapshot_date',
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'program_id',
      references: {
        model: 'programs',
        key: 'id',
      },
    },
    a1Count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'a1_count',
    },
    a7Count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'a7_count',
    },
    a30Count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'a30_count',
    },
  },
  {
    sequelize,
    tableName: 'active_user_metrics',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['snapshot_date', 'program_id'],
        name: 'active_user_metrics_date_program_unique',
      },
      { fields: ['snapshot_date'] },
    ],
  }
);

export default ActiveUserMetric;
