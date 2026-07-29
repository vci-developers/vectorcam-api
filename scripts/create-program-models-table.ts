import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createProgramModelsTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Ensuring programs.config column exists (if not exists)...');
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('programs')) {
      throw new Error('programs table does not exist; run base migrations first');
    }

    const programColumns = await queryInterface.describeTable('programs');
    if (!programColumns['config']) {
      await queryInterface.addColumn('programs', 'config', {
        type: DataTypes.JSON,
        allowNull: true,
      });
      console.log('Added config column');
    } else {
      console.log('config already exists, skipping addColumn');
    }

    if (programColumns['model_version']) {
      console.log('Note: model_version still exists; run migrate-program-models-to-model-ids.ts to migrate and remove it');
    }

    if (!tables.includes('program_models')) {
      console.log('Creating program_models table...');
      await queryInterface.createTable('program_models', {
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
        model_id: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        filename: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        s3_key: {
          type: DataTypes.STRING(512),
          allowNull: false,
        },
        model_classes: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        file_size: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        file_md5: {
          type: DataTypes.STRING(32),
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

      await queryInterface.addIndex('program_models', ['program_id', 'model_id'], {
        unique: true,
        name: 'program_models_program_id_model_id',
      });
      console.log('Created program_models table');
    } else {
      console.log('program_models table already exists, skipping createTable');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
    process.exit(process.exitCode ?? 0);
  }
}

createProgramModelsTable();
