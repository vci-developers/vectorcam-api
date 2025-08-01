import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionTypeColumn() {
  try {
    console.log('Adding type column to sessions table...');
    
    // Add the type column as STRING with empty string default
    await sequelize.getQueryInterface().addColumn('sessions', 'type', {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    });
    
    console.log('Successfully added type column to sessions table');
    
    // Add a check constraint to ensure only valid values are allowed
    await sequelize.query(
      "ALTER TABLE sessions ADD CONSTRAINT check_session_type CHECK (type IN ('SURVEILLANCE', 'DATA_COLLECTION', ''))"
    );
    
    console.log('Added check constraint for session type validation');
    
  } catch (error) {
    console.error('Error adding type column to sessions table:', error);
    throw error;
  }
}

async function main() {
  try {
    await addSessionTypeColumn();
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

export default addSessionTypeColumn; 