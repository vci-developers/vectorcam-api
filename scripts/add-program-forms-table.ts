import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../src/db/index';
import { defaultFormConstants } from '../src/handlers/program/form/defaultForm';

interface IndexField {
  attribute?: string;
  name?: string;
}

interface IndexInfo {
  name?: string;
  unique?: boolean;
  fields?: IndexField[];
}

interface ProgramRow {
  id: number;
  default_program_form_id: number | null;
}

interface FormRow {
  id: number;
  program_id: number;
  program_form_id: number | null;
  name: string;
  version: string;
}

function indexFields(index: IndexInfo): string[] {
  return (index.fields ?? []).map((field) => field.attribute ?? field.name ?? '');
}

function isUniqueIndex(index: IndexInfo): boolean {
  return Boolean(index.unique);
}

function readConstraintName(row: Record<string, unknown>): string | undefined {
  const value = row.constraintName ?? row.CONSTRAINT_NAME ?? row.constraint_name;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function enforceProgramFormIdNotNull() {
  const constraints = await sequelize.query<Record<string, unknown>>(
    `SELECT CONSTRAINT_NAME AS constraintName
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'forms'
       AND COLUMN_NAME = 'program_form_id'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { type: QueryTypes.SELECT }
  );

  for (const constraint of constraints) {
    const constraintName = readConstraintName(constraint);
    if (!constraintName) {
      continue;
    }
    console.log(`Dropping foreign key ${constraintName} before NOT NULL change...`);
    await sequelize.query(`ALTER TABLE forms DROP FOREIGN KEY \`${constraintName}\``);
  }

  console.log('Enforcing NOT NULL on forms.program_form_id...');
  await sequelize.query('ALTER TABLE forms MODIFY program_form_id INT NOT NULL');

  console.log('Restoring forms.program_form_id foreign key...');
  await sequelize.query(`
    ALTER TABLE forms
    ADD CONSTRAINT forms_program_form_id_fk
    FOREIGN KEY (program_form_id) REFERENCES program_forms (id)
    ON DELETE CASCADE
  `);
}

async function addProgramFormsTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('programs')) {
      throw new Error('programs table does not exist');
    }
    if (!tables.includes('forms')) {
      throw new Error('forms table does not exist; run create-forms-tables first');
    }

    if (!tables.includes('program_forms')) {
      console.log('Creating program_forms table...');
      await queryInterface.createTable('program_forms', {
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
      console.log('Created program_forms table');
    } else {
      console.log('program_forms table already exists, skipping create');
    }

    const programColumns = await queryInterface.describeTable('programs');
    if (!programColumns.default_program_form_id) {
      console.log('Adding programs.default_program_form_id...');
      await queryInterface.addColumn('programs', 'default_program_form_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'program_forms',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    } else {
      console.log('programs.default_program_form_id already exists');
    }

    const formColumns = await queryInterface.describeTable('forms');
    if (!formColumns.program_form_id) {
      console.log('Adding forms.program_form_id (nullable for backfill)...');
      await queryInterface.addColumn('forms', 'program_form_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'program_forms',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    } else {
      console.log('forms.program_form_id already exists');
    }

    console.log('Backfilling program_forms and forms.program_form_id...');
    const programs = await sequelize.query<ProgramRow>(
      'SELECT id, default_program_form_id FROM programs ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    for (const program of programs) {
      let programFormId = program.default_program_form_id;

      const formRows = await sequelize.query<FormRow>(
        `SELECT id, program_id, program_form_id, name, version
         FROM forms
         WHERE program_id = :programId
         ORDER BY CASE WHEN version = '' THEN 0 ELSE 1 END, id ASC`,
        {
          type: QueryTypes.SELECT,
          replacements: { programId: program.id },
        }
      );

      if (formRows.length === 0) {
        console.log(`Program ${program.id} has no forms; leaving it unchanged`);
        continue;
      }

      if (programFormId === null) {
        const draft = formRows.find((row) => row.version === '');
        const displayName = draft?.name ?? formRows[0]?.name ?? defaultFormConstants.DEFAULT_FORM_NAME;

        await sequelize.query(
          `INSERT INTO program_forms (program_id, name, created_at, updated_at)
           VALUES (:programId, :name, NOW(), NOW())`,
          {
            type: QueryTypes.INSERT,
            replacements: { programId: program.id, name: displayName },
          }
        );

        const created = await sequelize.query<{ id: number }>(
          `SELECT id FROM program_forms
           WHERE program_id = :programId
           ORDER BY id DESC
           LIMIT 1`,
          {
            type: QueryTypes.SELECT,
            replacements: { programId: program.id },
          }
        );
        programFormId = created[0]?.id;
        if (!programFormId) {
          throw new Error(`Failed to create program_form for program ${program.id}`);
        }

        console.log(`Created default program_form ${programFormId} for program ${program.id}`);

        await sequelize.query(
          'UPDATE programs SET default_program_form_id = :programFormId WHERE id = :programId',
          {
            type: QueryTypes.UPDATE,
            replacements: { programFormId, programId: program.id },
          }
        );
      }

      await sequelize.query(
        `UPDATE forms
         SET program_form_id = :programFormId
         WHERE program_id = :programId AND (program_form_id IS NULL OR program_form_id = 0)`,
        {
          type: QueryTypes.UPDATE,
          replacements: { programFormId, programId: program.id },
        }
      );
    }

    const orphanForms = await sequelize.query<{ id: number }>(
      'SELECT id FROM forms WHERE program_form_id IS NULL LIMIT 1',
      { type: QueryTypes.SELECT }
    );
    if (orphanForms.length > 0) {
      throw new Error('Backfill incomplete: some forms rows still have NULL program_form_id');
    }

    await enforceProgramFormIdNotNull();

    const formIndexes = (await queryInterface.showIndex('forms')) as IndexInfo[];
    for (const index of formIndexes) {
      const fields = indexFields(index);
      const isLegacyProgramVersion = isUniqueIndex(index)
        && fields.length === 2
        && fields.includes('program_id')
        && fields.includes('version')
        && index.name
        && index.name !== 'PRIMARY';
      if (isLegacyProgramVersion && index.name) {
        console.log(`Dropping legacy unique index ${index.name} on (program_id, version)...`);
        await queryInterface.removeIndex('forms', index.name);
      }
    }

    const indexesAfterDrop = (await queryInterface.showIndex('forms')) as IndexInfo[];
    const hasProgramFormVersionIndex = indexesAfterDrop.some((index) => {
      const fields = indexFields(index);
      return (
        isUniqueIndex(index)
        && fields.length === 2
        && fields.includes('program_form_id')
        && fields.includes('version')
      );
    });

    if (!hasProgramFormVersionIndex) {
      console.log('Adding unique index on (program_form_id, version)...');
      await queryInterface.addIndex('forms', ['program_form_id', 'version'], {
        unique: true,
        name: 'forms_program_form_version',
      });
    } else {
      console.log('Unique index on (program_form_id, version) already exists');
    }

    console.log('program_forms migration completed successfully');
  } catch (error) {
    console.error('Error migrating program_forms:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addProgramFormsTable()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export default addProgramFormsTable;
