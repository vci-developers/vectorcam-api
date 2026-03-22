import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addPrerequisiteToFormQuestions() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking for prerequisite on form_questions...');
    const columns = await queryInterface.describeTable('form_questions');

    if (columns['prerequisite']) {
      console.log('prerequisite already exists, skipping');
      return;
    }

    await queryInterface.addColumn('form_questions', 'prerequisite', {
      type: DataTypes.JSON,
      allowNull: true,
    });

    console.log('Added prerequisite column to form_questions');
  } catch (error) {
    console.error('Error adding prerequisite to form_questions:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await addPrerequisiteToFormQuestions();
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

export default addPrerequisiteToFormQuestions;
