import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: User activity tracking schema
 * - users.last_active_at
 * - user_auth_events
 * - active_user_metrics
 *
 * Run with: npx ts-node scripts/migrate-user-activity-tracking.ts
 */
async function addLastActiveAtColumn() {
  const queryInterface = sequelize.getQueryInterface();
  const usersTable = await queryInterface.describeTable('users');

  if (usersTable.last_active_at) {
    console.log('users.last_active_at already exists, skipping addColumn');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    console.log('Adding last_active_at column to users table...');
    await queryInterface.addColumn(
      'users',
      'last_active_at',
      {
        type: DataTypes.DATE,
        allowNull: true,
      },
      { transaction }
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  await sequelize.query(
    'CREATE INDEX users_last_active_at_idx ON users(last_active_at)'
  ).catch(() => {
    console.log('users_last_active_at_idx already exists, skipping');
  });
}

async function createUserAuthEventsTable() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  if (tables.includes('user_auth_events')) {
    console.log('user_auth_events table already exists, skipping createTable');
    return;
  }

  console.log('Creating user_auth_events table...');
  await queryInterface.createTable('user_auth_events', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    event_type: {
      type: DataTypes.ENUM('login', 'logout', 'signup', 'token_refresh'),
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await sequelize.query('CREATE INDEX user_auth_events_user_id_idx ON user_auth_events(user_id)');
  await sequelize.query('CREATE INDEX user_auth_events_event_type_idx ON user_auth_events(event_type)');
  await sequelize.query('CREATE INDEX user_auth_events_created_at_idx ON user_auth_events(created_at)');
  await sequelize.query(
    'CREATE INDEX user_auth_events_user_created_idx ON user_auth_events(user_id, created_at)'
  );
}

async function createActiveUserMetricsTable() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  if (tables.includes('active_user_metrics')) {
    console.log('active_user_metrics table already exists, skipping createTable');
    return;
  }

  console.log('Creating active_user_metrics table...');
  await queryInterface.createTable('active_user_metrics', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    snapshot_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    a1_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    a7_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    a30_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await sequelize.query(
    'CREATE UNIQUE INDEX active_user_metrics_date_program_unique ON active_user_metrics(snapshot_date, program_id)'
  );
  await sequelize.query(
    'CREATE INDEX active_user_metrics_snapshot_date_idx ON active_user_metrics(snapshot_date)'
  );
}

async function migrateUserActivityTracking() {
  await addLastActiveAtColumn();
  await createUserAuthEventsTable();
  await createActiveUserMetricsTable();
  console.log('User activity tracking migration completed successfully');
}

async function main() {
  try {
    await migrateUserActivityTracking();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

export default migrateUserActivityTracking;
