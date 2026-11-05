import sequelize from '../src/db/index';

async function addSpecimenMolecularSpeciesColumn() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('specimens');

    if ('molecular_species' in columns) {
      console.log('specimens.molecular_species already exists, skipping');
      return;
    }

    console.log('Adding molecular_species column to specimens table...');
    await queryInterface.addColumn('specimens', 'molecular_species', {
      type: 'VARCHAR(255)',
      allowNull: true,
    });
    console.log('Successfully added molecular_species column to specimens table');
  } catch (error) {
    console.error('Error adding molecular_species column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSpecimenMolecularSpeciesColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
