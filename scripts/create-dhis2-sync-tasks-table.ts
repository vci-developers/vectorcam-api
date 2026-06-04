import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createDhis2SyncTasksTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Creating dhis2_sync_tasks table...');

    const tables = await queryInterface.showAllTables();
    if (tables.includes('dhis2_sync_tasks')) {
      console.log('dhis2_sync_tasks table already exists, checking for missing columns');
      const columns = await queryInterface.describeTable('dhis2_sync_tasks');

      if (!columns.collection_cycle_id) {
        await queryInterface.addColumn('dhis2_sync_tasks', 'collection_cycle_id', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'collection_cycles',
            key: 'id',
          },
        });
      }

      if (!columns.site_id) {
        await queryInterface.addColumn('dhis2_sync_tasks', 'site_id', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'sites',
            key: 'id',
          },
        });
      }

      await queryInterface.changeColumn('dhis2_sync_tasks', 'year', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      await queryInterface.changeColumn('dhis2_sync_tasks', 'month', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      await queryInterface.changeColumn('dhis2_sync_tasks', 'district', {
        type: DataTypes.STRING(255),
        allowNull: true,
      });

      await sequelize.query(
        'CREATE INDEX dhis2_sync_tasks_cycle_site ON dhis2_sync_tasks(collection_cycle_id, site_id)'
      ).catch(() => undefined);

      console.log('dhis2_sync_tasks table updated successfully');
      return;
    }

    await queryInterface.createTable('dhis2_sync_tasks', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'timed_out'),
        allowNull: false,
        defaultValue: 'pending',
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      district: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      site_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      collection_cycle_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'collection_cycles',
          key: 'id',
        },
      },
      site_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'sites',
          key: 'id',
        },
      },
      dry_run: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      request_body: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      requested_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      requested_by_auth_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      timeout_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 300,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      result: {
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

    await sequelize.query('CREATE INDEX dhis2_sync_tasks_status ON dhis2_sync_tasks(status)');
    await sequelize.query(
      'CREATE INDEX dhis2_sync_tasks_period_district ON dhis2_sync_tasks(year, month, district)'
    );
    await sequelize.query(
      'CREATE INDEX dhis2_sync_tasks_cycle_site ON dhis2_sync_tasks(collection_cycle_id, site_id)'
    );
    await sequelize.query('CREATE INDEX dhis2_sync_tasks_created_at ON dhis2_sync_tasks(created_at)');

    console.log('dhis2_sync_tasks table created successfully');
  } catch (error) {
    console.error('Error creating dhis2_sync_tasks table:', error);
    throw error;
  }
}

async function main() {
  try {
    await createDhis2SyncTasksTable();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default createDhis2SyncTasksTable;
