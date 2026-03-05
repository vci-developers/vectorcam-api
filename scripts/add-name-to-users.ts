import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add name column to users table.
 *
 * Run with: npx ts-node scripts/add-name-to-users.ts
 */
async function addNameToUsers() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('Adding name column to users table...');
    await qi.addColumn('users', 'name', {
      type: DataTypes.STRING(255),
      allowNull: true
    }, { transaction });

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
    await addNameToUsers();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default addNameToUsers;
