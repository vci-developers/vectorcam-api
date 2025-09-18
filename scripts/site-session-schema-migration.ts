import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function migrateSiteAndSessionSchema() {
  try {
    console.log('Starting Site and Session schema migration...');
    
    // Step 1: Add new columns to Site table
    console.log('Adding villageName column to sites table...');
    await sequelize.getQueryInterface().addColumn('sites', 'village_name', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
    
    console.log('Adding houseNumber column to sites table...');
    await sequelize.getQueryInterface().addColumn('sites', 'house_number', {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    });
    
    console.log('Adding isActive column to sites table...');
    await sequelize.getQueryInterface().addColumn('sites', 'is_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    
    // Step 2: Set specific default values for houseNumber based on site ID
    console.log('Setting specific default values for houseNumber...');
    
    // Set empty string for sites 1-10
    await sequelize.query(
      "UPDATE sites SET house_number = '' WHERE id BETWEEN 1 AND 10"
    );
    
    // Set "N/A" for site 11
    await sequelize.query(
      "UPDATE sites SET house_number = 'N/A' WHERE id = 11"
    );
    
    // Step 3: Migrate sentinelSite data to villageName
    console.log('Migrating sentinelSite data to villageName...');
    await sequelize.query(
      "UPDATE sites SET village_name = sentinel_site WHERE sentinel_site IS NOT NULL"
    );
    
    // Step 4: Drop sentinelSite column
    console.log('Dropping sentinelSite column...');
    await sequelize.getQueryInterface().removeColumn('sites', 'sentinel_site');
    
    // Step 5: Migrate session.houseNumber to session.notes
    console.log('Migrating session houseNumber data to notes...');
    
    // First, handle sessions that have houseNumber but no existing notes
    await sequelize.query(`
      UPDATE sessions 
      SET notes = CONCAT('House Number: ', house_number)
      WHERE house_number IS NOT NULL 
      AND house_number != '' 
      AND (notes IS NULL OR notes = '')
    `);
    
    // Then, handle sessions that have both houseNumber and existing notes
    await sequelize.query(`
      UPDATE sessions 
      SET notes = CONCAT(notes, '\nHouse Number: ', house_number)
      WHERE house_number IS NOT NULL 
      AND house_number != '' 
      AND notes IS NOT NULL 
      AND notes != ''
    `);
    
    // Step 6: Drop houseNumber column from sessions
    console.log('Dropping houseNumber column from sessions table...');
    await sequelize.getQueryInterface().removeColumn('sessions', 'house_number');
    
    console.log('Successfully completed Site and Session schema migration');
    
  } catch (error) {
    console.error('Error during Site and Session schema migration:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateSiteAndSessionSchema();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default migrateSiteAndSessionSchema;
