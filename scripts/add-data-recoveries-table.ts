import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Create the data_recoveries table. No foreign keys.
 *
 * Run with: npx ts-node scripts/add-data-recoveries-table.ts
 */
async function addDataRecoveriesTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('data_recoveries')) {
      console.log('Creating data_recoveries table...');
      await queryInterface.createTable('data_recoveries', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        idempotency_key: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
        },
        program_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        site_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        session_frontend_id: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        year: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        month: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: 'pending',
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        payload: {
          type: DataTypes.JSON,
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
      await queryInterface.addIndex('data_recoveries', ['program_id', 'year', 'month'], {
        name: 'data_recoveries_program_year_month',
      });
      await queryInterface.addIndex('data_recoveries', ['site_id'], {
        name: 'data_recoveries_site_id',
      });
      await queryInterface.addIndex('data_recoveries', ['status'], {
        name: 'data_recoveries_status',
      });
      await queryInterface.addIndex('data_recoveries', ['session_frontend_id'], {
        name: 'data_recoveries_session_frontend_id',
      });
      console.log('Created data_recoveries table');
    } else {
      console.log('data_recoveries table already exists, skipping create');
    }

    console.log('data_recoveries migration completed successfully');
  } catch (error) {
    console.error('Error migrating data_recoveries:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addDataRecoveriesTable()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export default addDataRecoveriesTable;
