import sequelize from '../src/db/index';

async function addSpecimenImageMetadataColumn() {
  try {
    console.log('Adding metadata column to specimen_images table...');

    await sequelize.getQueryInterface().addColumn('specimen_images', 'metadata', {
      type: 'JSON',
      allowNull: true,
    });

    console.log('Successfully added metadata column to specimen_images table');
  } catch (error) {
    console.error('Error adding metadata column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSpecimenImageMetadataColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
