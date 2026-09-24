import sequelize from '../src/db/index';

async function addSpecimenImageOriginalPredictionColumns() {
  const queryInterface = sequelize.getQueryInterface();

  const columns = ['original_species', 'original_sex', 'original_abdomen_status'] as const;

  try {
    for (const column of columns) {
      console.log(`Adding ${column} column to specimen_images table...`);
      await queryInterface.addColumn('specimen_images', column, {
        type: 'VARCHAR(255)',
        allowNull: true,
      });
      console.log(`Successfully added ${column} column`);
    }
  } catch (error) {
    console.error('Error adding original prediction columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSpecimenImageOriginalPredictionColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
