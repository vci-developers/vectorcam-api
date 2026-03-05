import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add artifacts column to annotations table.
 *
 * Run with: npx ts-node scripts/add-artifacts-to-annotations.ts
 */
async function addArtifactsToAnnotations() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('Adding artifacts column to annotations table...');
    await qi.addColumn('annotations', 'artifacts', {
      type: DataTypes.STRING(255),
      allowNull: true
    }, { transaction });

    await transaction.commit();
    console.log('Migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await addArtifactsToAnnotations();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default addArtifactsToAnnotations;
