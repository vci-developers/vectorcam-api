import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionConflictResolutionCollectionCycle() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding collection_cycle_id column to session_conflict_resolutions table...');

    const columns = await queryInterface.describeTable('session_conflict_resolutions');
    const addIndex = () => queryInterface.addIndex('session_conflict_resolutions', ['collection_cycle_id'], {
      name: 'idx_session_conflict_resolutions_collection_cycle_id',
    }).catch(() => undefined);

    if (columns.collection_cycle_id) {
      console.log('session_conflict_resolutions.collection_cycle_id already exists, skipping addColumn');
    } else {
      await queryInterface.addColumn('session_conflict_resolutions', 'collection_cycle_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'collection_cycles',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }

    await addIndex();
    console.log('Successfully added collection_cycle_id column to session_conflict_resolutions table');
  } catch (error) {
    console.error('Error adding collection_cycle_id column:', error);
    throw error;
  }
}

async function main() {
  try {
    await addSessionConflictResolutionCollectionCycle();
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

export default addSessionConflictResolutionCollectionCycle;
