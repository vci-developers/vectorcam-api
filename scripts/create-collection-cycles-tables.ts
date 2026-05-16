import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createCollectionCyclesTables() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('collection_schedules')) {
      console.log('Creating collection_schedules table...');
      await queryInterface.createTable('collection_schedules', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        program_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'programs',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        cadence_type: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        interval_unit: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        interval_count: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        effective_start_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        effective_end_date: {
          type: DataTypes.DATE,
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

      await queryInterface.addIndex('collection_schedules', ['program_id', 'effective_start_date'], {
        name: 'collection_schedules_program_start_idx',
      });
      await queryInterface.addIndex('collection_schedules', ['program_id', 'effective_end_date'], {
        name: 'collection_schedules_program_end_idx',
      });
    } else {
      console.log('collection_schedules table already exists, skipping createTable');
    }

    if (!tables.includes('collection_cycles')) {
      console.log('Creating collection_cycles table...');
      await queryInterface.createTable('collection_cycles', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        program_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'programs',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        collection_schedule_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'collection_schedules',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        cycle_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        start_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        end_date: {
          type: DataTypes.DATE,
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

      await queryInterface.addIndex('collection_cycles', ['collection_schedule_id', 'cycle_number'], {
        unique: true,
        name: 'collection_cycles_schedule_cycle_unique',
      });
      await queryInterface.addIndex('collection_cycles', ['program_id', 'start_date', 'end_date'], {
        name: 'collection_cycles_program_range_idx',
      });
    } else {
      console.log('collection_cycles table already exists, skipping createTable');
    }

    const sessionColumns = await queryInterface.describeTable('sessions');
    if (!sessionColumns['collection_cycle_id']) {
      console.log('Adding collection_cycle_id to sessions table...');
      await queryInterface.addColumn('sessions', 'collection_cycle_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'collection_cycles',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('sessions', ['collection_cycle_id'], {
        name: 'sessions_collection_cycle_idx',
      });
    } else {
      console.log('sessions.collection_cycle_id already exists, skipping addColumn');
    }

    console.log('Collection cycles migration completed successfully');
  } catch (error) {
    console.error('Error creating collection cycle tables:', error);
    throw error;
  }
}

async function main() {
  try {
    await createCollectionCyclesTables();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default createCollectionCyclesTables;
