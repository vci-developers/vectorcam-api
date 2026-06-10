import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addCollectionTimezoneColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const scheduleColumns = await queryInterface.describeTable('collection_schedules');
    if (!scheduleColumns.timezone) {
      console.log('Adding timezone column to collection_schedules table...');
      await queryInterface.addColumn('collection_schedules', 'timezone', {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
      });
    } else {
      console.log('collection_schedules.timezone already exists, skipping addColumn');
    }

    const cycleColumns = await queryInterface.describeTable('collection_cycles');
    if (!cycleColumns.timezone) {
      console.log('Adding timezone column to collection_cycles table...');
      await queryInterface.addColumn('collection_cycles', 'timezone', {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
      });
    } else {
      console.log('collection_cycles.timezone already exists, skipping addColumn');
    }

    console.log('Collection timezone migration completed successfully');
  } catch (error) {
    console.error('Error adding collection timezone columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addCollectionTimezoneColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
