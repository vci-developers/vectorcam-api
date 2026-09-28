import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addProgramModelDescriptionColumn() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('program_models')) {
      console.log('program_models table does not exist, skipping');
      return;
    }

    const columns = await queryInterface.describeTable('program_models');
    if (columns['description']) {
      console.log('description column already exists, skipping');
      return;
    }

    console.log('Adding description column to program_models...');
    await queryInterface.addColumn('program_models', 'description', {
      type: DataTypes.TEXT,
      allowNull: true,
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

addProgramModelDescriptionColumn();
