import sequelize from '../src/db/index';

async function addCollectorLastTrainedOnColumn() {
  try {
    console.log('Adding collector_last_trained_on column to sessions table...');
    
    // Add the collector last trained on column
    await sequelize.getQueryInterface().addColumn('sessions', 'collector_last_trained_on', {
      type: 'TIMESTAMP',
      allowNull: true
    });
    
    console.log('Successfully added collector_last_trained_on column to sessions table');
    
  } catch (error) {
    console.error('Error adding collector_last_trained_on column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addCollectorLastTrainedOnColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

