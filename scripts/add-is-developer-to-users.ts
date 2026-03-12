import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add is_developer column to users table.
 *
 * Run with: npx ts-node scripts/add-is-developer-to-users.ts
 */
async function addIsDeveloperToUsers() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    const tableDefinition = await qi.describeTable('users');
    if (tableDefinition.is_developer) {
      console.log('Column users.is_developer already exists. Skipping migration.');
      await transaction.commit();
      return;
    }

    console.log('Adding is_developer column to users table...');
    await qi.addColumn(
      'users',
      'is_developer',
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      { transaction }
    );

    await transaction.commit();
    console.log('Migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await addIsDeveloperToUsers();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default addIsDeveloperToUsers;
