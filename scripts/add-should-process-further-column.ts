import sequelize from '../src/db/index';

async function addShouldProcessFurtherColumn() {
  try {
    console.log('Adding should_process_further column to specimens table...');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Add the should_process_further column to the specimens table
    await queryInterface.addColumn('specimens', 'should_process_further', {
      type: 'BOOLEAN',
      allowNull: false,
      defaultValue: false,
    });
    
    console.log('✓ Successfully added should_process_further column to specimens table');
    
  } catch (error) {
    console.error('Error adding should_process_further column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addShouldProcessFurtherColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

