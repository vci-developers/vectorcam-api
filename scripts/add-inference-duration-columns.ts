import sequelize from '../src/db/index';

async function addInferenceDurationColumns() {
  try {
    console.log('Adding inference duration columns to inference_results table...');
    
    // Add the species inference duration column
    await sequelize.getQueryInterface().addColumn('inference_results', 'species_inference_duration', {
      type: 'INTEGER',
      allowNull: true
    });
    
    // Add the sex inference duration column
    await sequelize.getQueryInterface().addColumn('inference_results', 'sex_inference_duration', {
      type: 'INTEGER',
      allowNull: true
    });
    
    // Add the abdomen status inference duration column
    await sequelize.getQueryInterface().addColumn('inference_results', 'abdomen_status_inference_duration', {
      type: 'INTEGER',
      allowNull: true
    });
    
    console.log('Successfully added inference duration columns to inference_results table');
    
  } catch (error) {
    console.error('Error adding inference duration columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addInferenceDurationColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
