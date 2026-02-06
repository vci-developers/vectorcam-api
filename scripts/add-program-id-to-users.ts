import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add program_id to users/user_whitelist, and make location_types.program_id NOT NULL
 * 
 * This migration adds program-based separation:
 * - users.program_id: nullable FK to programs (null for non-whitelisted users)
 * - user_whitelist.program_id: NOT NULL FK to programs (whitelist always requires a program)
 * - location_types.program_id: changed from nullable to NOT NULL
 * 
 * All existing rows are backfilled with the first program.
 * user_whitelist and location_types are then altered to NOT NULL.
 * users.program_id stays nullable for registered-but-not-whitelisted users.
 * 
 * Run with: npx ts-node scripts/add-program-id-to-users.ts
 */
async function addProgramIdToUsers() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('Adding program_id column to users table...');
    await qi.addColumn('users', 'program_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    }, { transaction });

    console.log('Adding program_id column to user_whitelist table...');
    await qi.addColumn('user_whitelist', 'program_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    }, { transaction });

    // Backfill: assign all existing users and whitelist entries to the first program
    console.log('Looking up first program to assign to existing users...');
    const [programs] = await sequelize.query(
      'SELECT id FROM programs ORDER BY id ASC LIMIT 1',
      { transaction }
    ) as [Array<{ id: number }>, unknown];

    if (programs.length === 0) {
      throw new Error('No programs found. At least one program must exist before running this migration.');
    }

    const firstProgramId = programs[0].id;
    console.log(`Assigning existing users to program ${firstProgramId}...`);

    await sequelize.query(
      'UPDATE users SET program_id = ? WHERE program_id IS NULL',
      { replacements: [firstProgramId], transaction }
    );

    await sequelize.query(
      'UPDATE user_whitelist SET program_id = ? WHERE program_id IS NULL',
      { replacements: [firstProgramId], transaction }
    );

    await sequelize.query(
      'UPDATE location_types SET program_id = ? WHERE program_id IS NULL',
      { replacements: [firstProgramId], transaction }
    );

    console.log(`All existing users, whitelist entries, and location types assigned to program ${firstProgramId}.`);

    // Alter user_whitelist and location_types to NOT NULL
    // (users.program_id stays nullable for registered-but-not-whitelisted users)
    console.log('Setting program_id to NOT NULL on user_whitelist and location_types...');

    await qi.changeColumn('user_whitelist', 'program_id', {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    }, { transaction });

    await qi.changeColumn('location_types', 'program_id', {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
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
    await addProgramIdToUsers();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default addProgramIdToUsers;
