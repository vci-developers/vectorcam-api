import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add email_verified column to users table.
 *
 * Run with: npx ts-node scripts/add-email-verified-to-users.ts
 */
async function addEmailVerifiedToUsers() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    const tableDefinition = await qi.describeTable('users');
    if (tableDefinition.email_verified) {
      console.log('Column users.email_verified already exists. Skipping migration.');
      await transaction.commit();
      return;
    }

    console.log('Adding email_verified column to users table...');
    await qi.addColumn(
      'users',
      'email_verified',
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
    await addEmailVerifiedToUsers();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

export default addEmailVerifiedToUsers;
