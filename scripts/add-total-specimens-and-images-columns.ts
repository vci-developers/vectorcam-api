import sequelize from '../src/db/index';

async function addTotalSpecimensAndImagesColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    console.log('Adding total_specimens column to sessions table...');
    await queryInterface.addColumn('sessions', 'total_specimens', {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: 0,
    });
    console.log('✓ Added total_specimens column to sessions table');

    console.log('Adding total_images column to specimens table...');
    await queryInterface.addColumn('specimens', 'total_images', {
      type: 'INTEGER',
      allowNull: false,
      defaultValue: 0,
    });
    console.log('✓ Added total_images column to specimens table');

    console.log('✓ Successfully added both columns');
  } catch (error) {
    console.error('Error adding columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addTotalSpecimensAndImagesColumns()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
