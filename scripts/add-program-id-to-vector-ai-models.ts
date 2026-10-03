import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addProgramIdToVectorAiModels() {
  const programIdRaw = process.env.VECTOR_AI_MODEL_PROGRAM_ID?.trim();
  const programId = programIdRaw ? parseInt(programIdRaw, 10) : NaN;

  if (!Number.isInteger(programId) || programId <= 0) {
    throw new Error(
      'Set VECTOR_AI_MODEL_PROGRAM_ID to the program id for existing vector_ai_models rows before running this migration.'
    );
  }

  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable('vector_ai_models');

    if (!table.program_id) {
      console.log('Adding program_id column to vector_ai_models...');
      await queryInterface.addColumn('vector_ai_models', 'program_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'programs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    await sequelize.query('UPDATE vector_ai_models SET program_id = :programId WHERE program_id IS NULL', {
      replacements: { programId },
    });

    await queryInterface.changeColumn('vector_ai_models', 'program_id', {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });

    try {
      await sequelize.query('DROP INDEX vector_ai_models_field_version_unique ON vector_ai_models');
    } catch {
      // index may not exist under this name on all environments
    }

    await sequelize.query(
      'CREATE UNIQUE INDEX vector_ai_models_program_field_version_unique ON vector_ai_models (program_id, field, version)'
    );

    console.log('vector_ai_models.program_id migration completed successfully');
  } catch (error) {
    console.error('Error migrating vector_ai_models.program_id:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addProgramIdToVectorAiModels()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
