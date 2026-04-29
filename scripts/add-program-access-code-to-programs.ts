import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../src/db/index';
import { generateProgramAccessCode, isValidProgramAccessCode } from '../src/utils/programAccessCode';

interface ProgramRow {
  id: number;
  access_code: string | null;
}

interface IndexInfo {
  unique?: boolean;
  fields?: Array<{ attribute?: string; name?: string }>;
}

function generateUnusedAccessCode(usedCodes: Set<string>): string {
  let accessCode = generateProgramAccessCode();
  while (usedCodes.has(accessCode)) {
    accessCode = generateProgramAccessCode();
  }

  usedCodes.add(accessCode);
  return accessCode;
}

async function addProgramAccessCodeToPrograms() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking access_code column on programs table...');

    const columns = await queryInterface.describeTable('programs');
    if (!columns.access_code) {
      await queryInterface.addColumn('programs', 'access_code', {
        type: DataTypes.STRING(8),
        allowNull: true,
      });
      console.log('Added nullable access_code column');
    } else {
      console.log('access_code column already exists, checking values');
    }

    const programs = await sequelize.query<ProgramRow>(
      'SELECT id, access_code FROM programs ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    const usedCodes = new Set<string>();
    for (const program of programs) {
      const existingCode = program.access_code;
      if (existingCode && isValidProgramAccessCode(existingCode) && !usedCodes.has(existingCode)) {
        usedCodes.add(existingCode);
        continue;
      }

      const accessCode = generateUnusedAccessCode(usedCodes);
      await sequelize.query(
        'UPDATE programs SET access_code = :accessCode WHERE id = :programId',
        {
          replacements: { accessCode, programId: program.id },
          type: QueryTypes.UPDATE,
        }
      );
      console.log(`Set access_code for program ${program.id}`);
    }

    await queryInterface.changeColumn('programs', 'access_code', {
      type: DataTypes.STRING(8),
      allowNull: false,
    });

    const indexes = await queryInterface.showIndex('programs') as IndexInfo[];
    const hasAccessCodeIndex = indexes.some((index) => {
      const fields = index.fields?.map((field) => field.attribute ?? field.name);
      return index.unique === true && fields?.length === 1 && fields[0] === 'access_code';
    });

    if (!hasAccessCodeIndex) {
      await queryInterface.addIndex('programs', ['access_code'], {
        unique: true,
        name: 'programs_access_code_unique',
      });
      console.log('Added unique index on programs.access_code');
    } else {
      console.log('Unique index on programs.access_code already exists, skipping');
    }

    console.log('Successfully added access_code to programs table');
  } catch (error) {
    console.error('Error adding access_code to programs:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addProgramAccessCodeToPrograms()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
