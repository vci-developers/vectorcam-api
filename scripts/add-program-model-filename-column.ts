import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addProgramModelFilenameColumn() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('program_models')) {
      console.log('program_models table does not exist, skipping');
      return;
    }

    const columns = await queryInterface.describeTable('program_models');
    if (columns['filename']) {
      console.log('filename column already exists, skipping');
      return;
    }

    console.log('Adding filename column to program_models...');
    await queryInterface.addColumn('program_models', 'filename', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });

    console.log('Backfilling filename from model_id...');
    await sequelize.query(
      `UPDATE program_models SET filename = CONCAT(model_id, '.tflite') WHERE filename IS NULL`
    );

    await queryInterface.changeColumn('program_models', 'filename', {
      type: DataTypes.STRING(255),
      allowNull: false,
    });

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
    process.exit(process.exitCode ?? 0);
  }
}

addProgramModelFilenameColumn();
