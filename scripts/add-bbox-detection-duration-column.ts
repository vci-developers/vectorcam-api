import sequelize from '../src/db/index';

async function addBboxDetectionDurationColumn() {
  try {
    console.log('Adding bbox_detection_duration column to inference_results table...');
    
    // Add the bbox detection duration column
    await sequelize.getQueryInterface().addColumn('inference_results', 'bbox_detection_duration', {
      type: 'INTEGER',
      allowNull: true
    });
    
    console.log('Successfully added bbox_detection_duration column to inference_results table');
    
  } catch (error) {
    console.error('Error adding bbox_detection_duration column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addBboxDetectionDurationColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
