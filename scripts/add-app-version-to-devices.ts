import sequelize from '../src/db/index';

async function addAppVersionToDevices() {
  try {
    console.log('Checking app_version column on devices table...');
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable('devices');

    if (tableDefinition.app_version) {
      console.log('⏭ app_version column already exists, skipping');
      return;
    }

    console.log('Adding app_version column to devices table...');
    await queryInterface.addColumn('devices', 'app_version', {
      type: 'VARCHAR(50)',
      allowNull: true,
    });

    console.log('✓ Successfully added app_version column to devices table');
  } catch (error) {
    console.error('Error adding app_version column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addAppVersionToDevices()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
