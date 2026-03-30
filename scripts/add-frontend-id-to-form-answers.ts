import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addFrontendIdToFormAnswers() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking for frontend_id on form_answers...');
    const columns = await queryInterface.describeTable('form_answers');

    if (columns['frontend_id']) {
      console.log('frontend_id already exists, skipping');
      return;
    }

    await queryInterface.addColumn('form_answers', 'frontend_id', {
      type: DataTypes.STRING(64),
      allowNull: true,
    });

    console.log('Added frontend_id column to form_answers');
  } catch (error) {
    console.error('Error adding frontend_id to form_answers:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await addFrontendIdToFormAnswers();
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

export default addFrontendIdToFormAnswers;
