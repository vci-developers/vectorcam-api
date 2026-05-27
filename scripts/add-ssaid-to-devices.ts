import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSsaidToDevices() {
  try {
    console.log('Checking ssaid column on devices table...');
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable('devices');

    if (tableDefinition.ssaid) {
      console.log('ssaid column already exists, skipping');
      return;
    }

    console.log('Adding ssaid column to devices table...');
    await queryInterface.addColumn('devices', 'ssaid', {
      type: DataTypes.STRING(64),
      allowNull: true,
    });

    console.log('Successfully added ssaid column to devices table');
  } catch (error) {
    console.error('Error adding ssaid column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSsaidToDevices()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
