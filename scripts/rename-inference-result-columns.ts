import sequelize from '../src/db/index';

async function renameInferenceResultColumns() {
  try {
    console.log('Renaming columns in inference_results table...');
    const queryInterface = sequelize.getQueryInterface();

    // Rename species_probabilities to species_logits
    await queryInterface.renameColumn('inference_results', 'species_probabilities', 'species_logits');
    console.log('Renamed species_probabilities to species_logits');

    // Rename sex_probabilities to sex_logits
    await queryInterface.renameColumn('inference_results', 'sex_probabilities', 'sex_logits');
    console.log('Renamed sex_probabilities to sex_logits');

    // Rename abdomen_status_probabilities to abdomen_status_logits
    await queryInterface.renameColumn('inference_results', 'abdomen_status_probabilities', 'abdomen_status_logits');
    console.log('Renamed abdomen_status_probabilities to abdomen_status_logits');

    console.log('All columns renamed successfully.');
  } catch (error) {
    console.error('Error renaming columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
renameInferenceResultColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 