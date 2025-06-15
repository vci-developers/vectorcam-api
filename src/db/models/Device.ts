import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';

// Import models needed for associations
import Program from './Program';
import Session from './Session';

class Device extends Model {
  declare id: number;
  declare model: string;
  declare registeredAt: Date;
  declare programId: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Device.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    model: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'registered_at',
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      field: 'program_id',
    },
  },
  {
    sequelize,
    tableName: 'devices',
    underscored: true,
    timestamps: true,
  }
);

// Setup associations
Device.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
Program.hasMany(Device, { foreignKey: 'program_id', as: 'devices' });

Device.hasMany(Session, { foreignKey: 'device_id', as: 'sessions' });
Session.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

export default Device; 