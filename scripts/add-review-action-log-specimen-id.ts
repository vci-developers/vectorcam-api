import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addReviewActionLogSpecimenId() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding specimen_id column to review_action_logs table...');

    const columns = await queryInterface.describeTable('review_action_logs');
    const addIndex = () =>
      queryInterface
        .addIndex('review_action_logs', ['specimen_id'], {
          name: 'idx_review_action_logs_specimen_id',
        })
        .catch(() => undefined);

    if (columns.specimen_id) {
      console.log('review_action_logs.specimen_id already exists, skipping addColumn');
    } else {
      await queryInterface.addColumn('review_action_logs', 'specimen_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'specimens',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }

    await addIndex();

    await sequelize.query(`
      UPDATE review_action_logs
      SET specimen_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(fields, '$.specimenId')) AS UNSIGNED)
      WHERE specimen_id IS NULL
        AND JSON_EXTRACT(fields, '$.specimenId') IS NOT NULL
    `);
    console.log('Backfilled specimen_id from fields JSON where available');

    console.log('Successfully updated review_action_logs specimen_id column');
  } catch (error) {
    console.error('Error updating review_action_logs specimen_id column:', error);
    throw error;
  }
}

async function main() {
  try {
    await addReviewActionLogSpecimenId();
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

export default addReviewActionLogSpecimenId;
