import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionGpsAccuracyColumn() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const sessionColumns = await queryInterface.describeTable('sessions');

    if (!sessionColumns.gps_accuracy) {
      console.log('Adding gps_accuracy column to sessions table...');
      await queryInterface.addColumn('sessions', 'gps_accuracy', {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    } else {
      console.log('sessions.gps_accuracy already exists, skipping addColumn');
    }

    console.log('Session gps_accuracy migration completed successfully');
  } catch (error) {
    console.error('Error adding session gps_accuracy column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSessionGpsAccuracyColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
