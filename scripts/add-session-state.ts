import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionState() {
  try {
    console.log('Adding state column to sessions table...');

    await sequelize.getQueryInterface().addColumn('sessions', 'state', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NEEDS_REVIEW',
    });

    console.log('Successfully added state column to sessions table');
  } catch (error) {
    console.error('Error adding state column:', error);
    throw error;
  }
}

async function main() {
  try {
    await addSessionState();
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

export default addSessionState;
