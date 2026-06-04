import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionCertifiedBy() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding certified_by column to sessions table...');

    const columns = await queryInterface.describeTable('sessions');
    if (columns.certified_by) {
      console.log('sessions.certified_by already exists, skipping addColumn');
      return;
    }

    await queryInterface.addColumn('sessions', 'certified_by', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    console.log('Successfully added certified_by column to sessions table');
  } catch (error) {
    console.error('Error adding certified_by column:', error);
    throw error;
  }
}

async function main() {
  try {
    await addSessionCertifiedBy();
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

export default addSessionCertifiedBy;
