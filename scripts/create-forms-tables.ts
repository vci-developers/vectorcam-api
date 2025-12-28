import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';
import { Program, Form } from '../src/db/models';
import { createDefaultFormForProgram } from '../src/handlers/program/form/defaultForm';

async function createFormsTables() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding form_version to programs table (if not exists)...');
    const tables = await queryInterface.showAllTables();
    const hasPrograms = tables.includes('programs');
    if (!hasPrograms) {
      throw new Error('programs table does not exist; run base migrations first');
    }
    const programColumns = await queryInterface.describeTable('programs');
    if (!programColumns['form_version']) {
      await queryInterface.addColumn('programs', 'form_version', {
        type: DataTypes.STRING(64),
        allowNull: true,
      });
      console.log('Added form_version column');
    } else {
      console.log('form_version already exists, skipping addColumn');
    }

    console.log('Creating forms table...');
    await queryInterface.createTable('forms', {
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
      version: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: '',
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

    await queryInterface.addIndex('forms', ['program_id', 'version'], {
      unique: true,
      name: 'forms_program_version',
    });

    console.log('Creating form_questions table...');
    await queryInterface.createTable('form_questions', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      form_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'forms',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'form_questions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      label: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      options: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: true,
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

    console.log('Creating form_answers table...');
    await queryInterface.createTable('form_answers', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'sessions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      form_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'forms',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'form_questions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      value: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      data_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'text',
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
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

    await queryInterface.addIndex('form_answers', ['session_id', 'form_id', 'question_id'], {
      unique: true,
      name: 'form_answers_unique_session_form_question',
    });

    await queryInterface.addIndex('form_answers', ['submitted_at'], {
      name: 'form_answers_submitted_at_idx',
    });

    console.log('Forms tables created successfully');

    console.log('Seeding default draft form for existing programs (if missing)...');
    await seedDefaultForms();
    console.log('Default form seeding complete');
  } catch (error) {
    console.error('Error creating forms tables:', error);
    throw error;
  }
}

async function seedDefaultForms(): Promise<void> {
  const transaction = await sequelize.transaction();
  try {
    const programs = await Program.findAll({ transaction });

    for (const program of programs) {
      const existing = await Form.findOne({ where: { programId: program.id }, transaction });
      if (existing) continue;

      await createDefaultFormForProgram(program.id, transaction);
      console.log(`Created default draft form for program ${program.id} (${program.name})`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function main() {
  try {
    await createFormsTables();
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

export default createFormsTables;

