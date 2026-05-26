import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSessionUnits() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('session_units')) {
      await queryInterface.createTable('session_units', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        frontend_id: {
          type: DataTypes.STRING(64),
          allowNull: true,
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
        unit_order: {
          type: DataTypes.INTEGER,
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

      await queryInterface.addIndex('session_units', ['session_id', 'unit_order'], {
        name: 'session_units_session_order_idx',
      });
      await queryInterface.addIndex('session_units', ['session_id', 'frontend_id'], {
        name: 'session_units_session_frontend_idx',
      });
    }

    const questionColumns = await queryInterface.describeTable('form_questions');
    if (!questionColumns['answer_scope']) {
      await queryInterface.addColumn('form_questions', 'answer_scope', {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'SESSION',
      });
    }
    if (!questionColumns['is_unit_identity_component']) {
      await queryInterface.addColumn('form_questions', 'is_unit_identity_component', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    const answerColumns = await queryInterface.describeTable('form_answers');
    if (!answerColumns['session_unit_id']) {
      await queryInterface.addColumn('form_answers', 'session_unit_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'session_units',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }
    try {
      await queryInterface.removeIndex('form_answers', 'form_answers_unique_session_form_question');
    } catch {
      // Older databases may not have the legacy unique index name.
    }
    try {
      await queryInterface.addIndex('form_answers', ['session_id', 'session_unit_id', 'form_id', 'question_id'], {
        unique: true,
        name: 'form_answers_unique_session_unit_form_question',
      });
    } catch {
      // The index may already exist from a previous migration run.
    }

    const specimenColumns = await queryInterface.describeTable('specimens');
    if (!specimenColumns['session_unit_id']) {
      await queryInterface.addColumn('specimens', 'session_unit_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'session_units',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }
  } catch (error) {
    console.error('Error adding session units:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await addSessionUnits();
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

export default addSessionUnits;
