import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addReviewActionLogCollectionCycle() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding collection_cycle_id column to review_action_logs table...');

    const columns = await queryInterface.describeTable('review_action_logs');
    const addIndex = () => queryInterface.addIndex('review_action_logs', ['collection_cycle_id'], {
      name: 'idx_review_action_logs_collection_cycle_id',
    }).catch(() => undefined);

    if (columns.collection_cycle_id) {
      console.log('review_action_logs.collection_cycle_id already exists, skipping addColumn');
    } else {
      await queryInterface.addColumn('review_action_logs', 'collection_cycle_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'collection_cycles',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }

    if (columns.collection_cycle) {
      console.log('Dropping review_action_logs.collection_cycle column...');
      await queryInterface.removeColumn('review_action_logs', 'collection_cycle');
    }

    await addIndex();

    await sequelize.query(`
      UPDATE review_action_logs
      SET collection_cycle_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(fields, '$.collectionCycleId')) AS UNSIGNED)
      WHERE collection_cycle_id IS NULL
        AND JSON_EXTRACT(fields, '$.collectionCycleId') IS NOT NULL
    `);
    console.log('Backfilled collection_cycle_id from fields JSON where available');

    console.log('Successfully updated review_action_logs collection cycle columns');
  } catch (error) {
    console.error('Error updating review_action_logs collection cycle columns:', error);
    throw error;
  }
}

async function main() {
  try {
    await addReviewActionLogCollectionCycle();
    console.log('Migration completed successfully');
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

export default addReviewActionLogCollectionCycle;
