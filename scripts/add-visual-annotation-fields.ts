import { Annotation } from '../src/db/models';
import sequelize from '../src/db/index';

async function addVisualAnnotationFields() {
  try {
    console.log('Adding visual annotation fields to annotations table...');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Add the new visual fields
    await queryInterface.addColumn('annotations', 'visual_species', {
      type: 'VARCHAR(255)',
      allowNull: true,
    });
    console.log('✓ Added visual_species column');
    
    await queryInterface.addColumn('annotations', 'visual_sex', {
      type: 'VARCHAR(50)',
      allowNull: true,
    });
    console.log('✓ Added visual_sex column');
    
    await queryInterface.addColumn('annotations', 'visual_abdomen_status', {
      type: 'VARCHAR(100)',
      allowNull: true,
    });
    console.log('✓ Added visual_abdomen_status column');
    
    console.log('Successfully added all visual annotation columns');
    
    // Migrate data from morph fields to visual fields
    console.log('Migrating data from morph fields to visual fields...');
    
    const [updatedCount] = await sequelize.query(`
      UPDATE annotations
      SET 
        visual_species = morph_species,
        visual_sex = morph_sex,
        visual_abdomen_status = morph_abdomen_status
      WHERE morph_species IS NOT NULL 
         OR morph_sex IS NOT NULL 
         OR morph_abdomen_status IS NOT NULL
    `);
    
    console.log(`✓ Migrated data for ${updatedCount} annotations`);
    
    // Set morph fields to NULL
    console.log('Setting morph fields to NULL...');
    
    await sequelize.query(`
      UPDATE annotations
      SET 
        morph_species = NULL,
        morph_sex = NULL,
        morph_abdomen_status = NULL
    `);
    
    console.log('✓ Successfully set all morph fields to NULL');
    
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addVisualAnnotationFields()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

