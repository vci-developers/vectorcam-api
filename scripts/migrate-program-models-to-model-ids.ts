import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

interface IndexField {
  attribute?: string;
}

interface IndexInfo {
  name?: string;
  unique?: boolean;
  fields?: IndexField[];
}

async function migrateProgramModelsToModelIds() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('programs')) {
      throw new Error('programs table does not exist; run base migrations first');
    }

    const programColumns = await queryInterface.describeTable('programs');

    if (!programColumns['config']) {
      console.log('Adding config column to programs...');
      await queryInterface.addColumn('programs', 'config', {
        type: DataTypes.JSON,
        allowNull: true,
      });
      console.log('Added config column');
    } else {
      console.log('config column already exists, skipping');
    }

    if (programColumns['model_version']) {
      console.log('Migrating model_version values into config...');
      const [programsWithModelVersion] = await sequelize.query(
        `SELECT id, model_version FROM programs WHERE model_version IS NOT NULL AND model_version != ''`
      );
      for (const row of programsWithModelVersion as Array<{ id: number; model_version: string }>) {
        await sequelize.query(
          `UPDATE programs SET config = JSON_OBJECT('models', JSON_OBJECT('default', :modelVersion)) WHERE id = :id`,
          { replacements: { modelVersion: row.model_version, id: row.id } }
        );
      }
      console.log('Removing model_version column from programs...');
      await queryInterface.removeColumn('programs', 'model_version');
      console.log('Removed model_version column');
    } else {
      console.log('model_version column already removed, skipping');
    }

    if (!tables.includes('program_models')) {
      console.log('program_models table does not exist, nothing to migrate');
      console.log('Migration completed successfully');
      return;
    }

    const modelColumns = await queryInterface.describeTable('program_models');

    if (modelColumns['version'] && !modelColumns['model_id']) {
      console.log('Renaming program_models.version to model_id...');
      await queryInterface.renameColumn('program_models', 'version', 'model_id');
      console.log('Renamed version -> model_id');
    } else if (modelColumns['model_id']) {
      console.log('program_models.model_id already exists, skipping rename');
    } else {
      throw new Error('program_models table is missing both version and model_id columns');
    }

    const indexes = (await queryInterface.showIndex('program_models')) as IndexInfo[];
    const targetIndexName = 'program_models_program_id_model_id';
    const oldIndexName = 'program_models_program_version';

    if (indexes.some((index) => index.name === targetIndexName)) {
      console.log(`${targetIndexName} already exists, skipping index migration`);
    } else {
      const oldIndex = indexes.find((index) => index.name === oldIndexName);
      if (oldIndex) {
        console.log(`Renaming index ${oldIndexName} -> ${targetIndexName}...`);
        await sequelize.query(
          `ALTER TABLE program_models RENAME INDEX \`${oldIndexName}\` TO \`${targetIndexName}\``
        );
        console.log('Renamed index');
      } else {
        const hasEquivalentUnique = indexes.some((index) => {
          if (!index.unique) {
            return false;
          }
          const fields = (index.fields || []).map((field) => field.attribute);
          return fields.length === 2 && fields[0] === 'program_id' && fields[1] === 'model_id';
        });

        if (hasEquivalentUnique) {
          console.log('Unique index on (program_id, model_id) already exists under another name, skipping');
        } else {
          await queryInterface.addIndex('program_models', ['program_id', 'model_id'], {
            unique: true,
            name: targetIndexName,
          });
          console.log(`Added ${targetIndexName} index`);
        }
      }
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

migrateProgramModelsToModelIds();
