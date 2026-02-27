import sequelize from '../src/db/index';

async function addExpectedSpecimensAndImagesColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    console.log('Dropping total_specimens column from sessions table if it exists...');
    try {
      await queryInterface.removeColumn('sessions', 'total_specimens');
      console.log('✓ Dropped total_specimens column from sessions table');
    } catch {
      console.log('⏭ total_specimens column does not exist, skipping');
    }

    console.log('Dropping total_images column from specimens table if it exists...');
    try {
      await queryInterface.removeColumn('specimens', 'total_images');
      console.log('✓ Dropped total_images column from specimens table');
    } catch {
      console.log('⏭ total_images column does not exist, skipping');
    }

    console.log('Adding expected_specimens column to sessions table...');
    await queryInterface.addColumn('sessions', 'expected_specimens', {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: 0,
    });
    console.log('✓ Added expected_specimens column to sessions table');

    console.log('Adding expected_images column to specimens table...');
    await queryInterface.addColumn('specimens', 'expected_images', {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: 0,
    });
    console.log('✓ Added expected_images column to specimens table');

    console.log('✓ Successfully migrated both columns');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addExpectedSpecimensAndImagesColumns()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
