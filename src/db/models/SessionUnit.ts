import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import Session from './Session';
import Specimen from './Specimen';

class SessionUnit extends Model {
  declare id: number;
  declare frontendId: string | null;
  declare sessionId: number;
  declare unitOrder: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SessionUnit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    frontendId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'frontend_id',
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'id',
      },
      field: 'session_id',
      onDelete: 'CASCADE',
    },
    unitOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'unit_order',
    },
  },
  {
    sequelize,
    tableName: 'session_units',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['session_id', 'unit_order'],
      },
      {
        fields: ['session_id', 'frontend_id'],
      },
    ],
  }
);

SessionUnit.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
Session.hasMany(SessionUnit, { foreignKey: 'session_id', as: 'sessionUnits' });
SessionUnit.hasMany(Specimen, { foreignKey: 'session_unit_id', as: 'specimens' });
Specimen.belongsTo(SessionUnit, { foreignKey: 'session_unit_id', as: 'sessionUnit' });

export default SessionUnit;
