import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Create the workflows table. One row per program.
 *
 * Run with: npx ts-node scripts/add-workflows-table.ts
 */
async function addWorkflowsTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('programs')) {
      throw new Error('programs table does not exist');
    }

    if (!tables.includes('workflows')) {
      console.log('Creating workflows table...');
      await queryInterface.createTable('workflows', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        program_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'programs',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        schema: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        is_active: {
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
      await queryInterface.addIndex('workflows', ['program_id'], {
        unique: true,
        name: 'workflows_program_id',
      });
      console.log('Created workflows table');
    } else {
      console.log('workflows table already exists, skipping create');
    }

    console.log('workflows migration completed successfully');
  } catch (error) {
    console.error('Error migrating workflows:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addWorkflowsTable()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export default addWorkflowsTable;
