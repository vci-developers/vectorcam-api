import { Model, DataTypes } from 'sequelize';
import sequelize from '../index';
import { SessionState } from './Session';

class SessionConflictResolution extends Model {
  declare id: number;
  declare resolvedByUserId: number | null;
  declare resolvedAt: Date;
  declare sessionIds: number[];
  declare siteId: number;
  declare month: number;
  declare year: number;
  declare beforeData: {
    sessions: {
      sessionId: number;
      frontendId: string;
      collectorTitle: string | null;
      collectorName: string | null;
      collectionDate: number | null;
      collectionMethod: string | null;
      specimenCondition: string | null;
      createdAt: number | null;
      completedAt: number | null;
      notes: string | null;
      latitude: number | null;
      longitude: number | null;
      type: string;
      collectorLastTrainedOn: number | null;
      hardwareId: string | null;
      totalSpecimens: number;
      state: SessionState;
    }[];
    surveillanceForms: {
      sessionId: number;
      numPeopleSleptInHouse: number | null;
      wasIrsConducted: boolean | null;
      monthsSinceIrs: number | null;
      numLlinsAvailable: number | null;
      llinType: string | null;
      llinBrand: string | null;
      numPeopleSleptUnderLlin: number | null;
    }[];
  };
  declare afterData: {
    collectorTitle: string | null;
    collectorName: string | null;
    collectionDate: number | null;
    collectionMethod: string | null;
    specimenCondition: string | null;
    createdAt: number | null;
    completedAt: number | null;
    notes: string | null;
    latitude: number | null;
    longitude: number | null;
    type: string;
    collectorLastTrainedOn: number | null;
    hardwareId: string | null;
    totalSpecimens: number;
    state: SessionState;
    surveillanceForm: {
      numPeopleSleptInHouse: number | null;
      wasIrsConducted: boolean | null;
      monthsSinceIrs: number | null;
      numLlinsAvailable: number | null;
      llinType: string | null;
      llinBrand: string | null;
      numPeopleSleptUnderLlin: number | null;
    } | null;
  };
  declare createdAt: Date;
  declare updatedAt: Date;
}

SessionConflictResolution.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    resolvedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'resolved_by_user_id',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'resolved_at',
    },
    sessionIds: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'session_ids',
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'site_id',
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12,
      },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    beforeData: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'before_data',
    },
    afterData: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'after_data',
    },
  },
  {
    sequelize,
    tableName: 'session_conflict_resolutions',
    underscored: true,
    timestamps: true,
  }
);

export default SessionConflictResolution;

