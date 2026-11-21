import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';
import '../src/db/models';
import { backfillLegacyRoleAssignments } from '../src/services/roles.service';

/**
 * Migration: create roles, role_permissions and user_roles, sync the built-in roles,
 * and give every user without roles the assignment matching their legacy privilege.
 * Safe to re-run: existing tables are kept, built-in role permissions are re-synced,
 * and users who already have role assignments are left untouched.
 *
 * Run with: npx ts-node scripts/create-roles-tables.ts
 */
async function createRolesTables() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  if (!tables.includes('roles')) {
    console.log('Creating roles table...');
    await queryInterface.createTable('roles', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      program_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'programs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  } else {
    console.log('roles table already exists, skipping');
  }

  if (!tables.includes('role_permissions')) {
    console.log('Creating role_permissions table...');
    await queryInterface.createTable('role_permissions', {
      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'roles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      permission: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
    });
  } else {
    console.log('role_permissions table already exists, skipping');
  }

  if (!tables.includes('user_roles')) {
    console.log('Creating user_roles table...');
    await queryInterface.createTable('user_roles', {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'roles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      scope: {
        type: DataTypes.ENUM('program', 'assigned_sites'),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
    await sequelize.query('CREATE INDEX user_roles_role_id ON user_roles(role_id)');
  } else {
    console.log('user_roles table already exists, skipping');
  }

  const transaction = await sequelize.transaction();
  try {
    const backfilled = await backfillLegacyRoleAssignments(transaction);
    await transaction.commit();
    console.log(`Built-in roles synced. Users backfilled from legacy privilege: ${backfilled}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function main() {
  try {
    await createRolesTables();
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

export default createRolesTables;
