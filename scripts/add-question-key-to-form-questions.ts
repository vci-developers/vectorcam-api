import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../src/db/index';
import {
  allocateQuestionKeyInForm,
  questionMatchSignature,
} from '../src/utils/formQuestionKey';

type QuestionRow = {
  id: number;
  form_id: number;
  program_id: number;
  parent_id: number | null;
  label: string;
  type: string;
  question_key: string | null;
};

async function addQuestionKeyToFormQuestions() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking for question_key on form_questions...');
    const columns = await queryInterface.describeTable('form_questions');

    if (!columns['question_key']) {
      await queryInterface.addColumn('form_questions', 'question_key', {
        type: DataTypes.STRING(64),
        allowNull: true,
      });
      console.log('Added question_key column');
    } else {
      console.log('question_key column already exists');
    }

    const indexes = (await queryInterface.showIndex('form_questions')) as Array<{ name?: string }>;
    const hasFormQuestionKeyIndex = indexes.some(
      idx => idx.name === 'form_questions_form_id_question_key'
    );

    const questions = await sequelize.query<QuestionRow>(
      `
        SELECT
          fq.id,
          fq.form_id,
          f.program_id,
          fq.parent_id,
          fq.label,
          fq.type,
          fq.question_key
        FROM form_questions fq
        INNER JOIN forms f ON f.id = fq.form_id
        ORDER BY f.program_id ASC, f.id ASC, fq.parent_id ASC, fq.\`order\` ASC, fq.id ASC
      `,
      { type: QueryTypes.SELECT }
    );

    const needsBackfill = questions.some(q => !q.question_key);
    if (!needsBackfill) {
      console.log('All questions already have question_key, skipping backfill');
    } else {
      console.log(`Backfilling question_key for ${questions.length} question row(s)...`);

      const questionsByForm = new Map<number, QuestionRow[]>();
      for (const q of questions) {
        if (!questionsByForm.has(q.form_id)) {
          questionsByForm.set(q.form_id, []);
        }
        questionsByForm.get(q.form_id)!.push(q);
      }

      const programSignatureToKey = new Map<number, Map<string, string>>();
      const keysByForm = new Map<number, Set<string>>();
      const assignedKeyByQuestionId = new Map<number, string>();

      const getKeysInForm = (formId: number): Set<string> => {
        if (!keysByForm.has(formId)) {
          keysByForm.set(formId, new Set());
        }
        return keysByForm.get(formId)!;
      };

      const getProgramSignatures = (programId: number): Map<string, string> => {
        if (!programSignatureToKey.has(programId)) {
          programSignatureToKey.set(programId, new Map());
        }
        return programSignatureToKey.get(programId)!;
      };

      const assignInTreeOrder = (formId: number, programId: number, parentId: number | null): void => {
        const formQuestions = questionsByForm.get(formId) || [];
        const siblings = formQuestions.filter(q => (q.parent_id ?? null) === parentId);

        for (const q of siblings) {
          const parentKey =
            q.parent_id === null ? null : assignedKeyByQuestionId.get(q.parent_id) ?? null;
          const signature = questionMatchSignature(parentKey, q.label, q.type);
          const programSignatures = getProgramSignatures(programId);
          const keysInForm = getKeysInForm(formId);

          let key = q.question_key ?? null;
          if (!key) {
            const matchedKey = programSignatures.get(signature);
            if (matchedKey && !keysInForm.has(matchedKey)) {
              key = matchedKey;
            } else {
              key = allocateQuestionKeyInForm(q.label, keysInForm);
              if (!programSignatures.has(signature)) {
                programSignatures.set(signature, key);
              }
            }
          }

          if (!keysInForm.has(key)) {
            keysInForm.add(key);
          }

          assignedKeyByQuestionId.set(q.id, key);
          assignInTreeOrder(formId, programId, q.id);
        }
      };

      const formsByProgram = new Map<number, number[]>();
      for (const q of questions) {
        if (!formsByProgram.has(q.program_id)) {
          formsByProgram.set(q.program_id, []);
        }
        const forms = formsByProgram.get(q.program_id)!;
        if (!forms.includes(q.form_id)) {
          forms.push(q.form_id);
        }
      }

      for (const [programId, formIds] of formsByProgram) {
        for (const formId of formIds) {
          assignInTreeOrder(formId, programId, null);
        }
      }

      await sequelize.transaction(async transaction => {
        for (const [questionId, key] of assignedKeyByQuestionId) {
          await sequelize.query(
            `UPDATE form_questions SET question_key = :key WHERE id = :id`,
            {
              replacements: { key, id: questionId },
              transaction,
            }
          );
        }
      });

      console.log(`Assigned question_key to ${assignedKeyByQuestionId.size} question row(s)`);
    }

    const refreshedColumns = await queryInterface.describeTable('form_questions');
    if (refreshedColumns['question_key']?.allowNull !== false) {
      await queryInterface.changeColumn('form_questions', 'question_key', {
        type: DataTypes.STRING(64),
        allowNull: false,
      });
      console.log('Set question_key to NOT NULL');
    }

    if (!hasFormQuestionKeyIndex) {
      await queryInterface.addIndex('form_questions', ['form_id', 'question_key'], {
        unique: true,
        name: 'form_questions_form_id_question_key',
      });
      console.log('Added unique index on (form_id, question_key)');
    }
  } catch (error) {
    console.error('Error adding question_key to form_questions:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await addQuestionKeyToFormQuestions();
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

export default addQuestionKeyToFormQuestions;
