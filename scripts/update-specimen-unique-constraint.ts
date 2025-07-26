import sequelize from '../src/db/index';

async function updateSpecimenUniqueConstraint() {
  try {
    console.log('Updating unique constraint on specimens table...');
    const queryInterface = sequelize.getQueryInterface();

    // First, let's check if there are any existing unique constraints on specimen_id
    const tableDescription = await queryInterface.describeTable('specimens');
    console.log('Current table structure:', tableDescription);

    // Get existing indexes to check for current unique constraints
    const indexes = await queryInterface.showIndex('specimens') as any[];
    console.log('Current indexes:', indexes);

    // Find the existing unique constraint on specimen_id (if it exists)
    const specimenIdUniqueIndex = indexes.find(index => 
      index.fields.some((field: any) => field.attribute === 'specimen_id') && 
      index.unique && 
      index.fields.length === 1
    );

    if (specimenIdUniqueIndex) {
      console.log('Found existing unique constraint on specimen_id, removing it...');
      await queryInterface.removeIndex('specimens', specimenIdUniqueIndex.name);
      console.log('Removed unique constraint on specimen_id');
    } else {
      console.log('No existing unique constraint found on specimen_id');
    }

    // Check if the composite unique constraint already exists
    const compositeUniqueIndex = indexes.find(index => 
      index.fields.length === 2 &&
      index.fields.some((field: any) => field.attribute === 'session_id') &&
      index.fields.some((field: any) => field.attribute === 'specimen_id') &&
      index.unique
    );

    if (compositeUniqueIndex) {
      console.log('Composite unique constraint on (session_id, specimen_id) already exists');
    } else {
      console.log('Adding composite unique constraint on (session_id, specimen_id)...');
      await queryInterface.addIndex('specimens', ['session_id', 'specimen_id'], {
        unique: true,
        name: 'specimens_session_id_specimen_id_unique'
      });
      console.log('Added composite unique constraint on (session_id, specimen_id)');
    }

    // Verify the changes by showing the updated indexes
    const updatedIndexes = await queryInterface.showIndex('specimens') as any[];
    console.log('Updated indexes:', updatedIndexes);

    console.log('Successfully updated unique constraint on specimens table');
  } catch (error) {
    console.error('Error updating unique constraint:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
updateSpecimenUniqueConstraint()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 