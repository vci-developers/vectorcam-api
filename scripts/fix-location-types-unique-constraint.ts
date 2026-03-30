import sequelize from '../src/db/index';

interface IndexField {
  attribute?: string;
}

interface IndexInfo {
  name?: string;
  unique?: boolean;
  fields?: IndexField[];
}

async function fixLocationTypesUniqueConstraint() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = 'location_types';
  const targetIndexName = 'location_types_program_name_unique';

  try {
    console.log('Inspecting indexes on location_types...');
    const indexes = (await queryInterface.showIndex(tableName)) as IndexInfo[];

    const nameOnlyUniqueIndexes = indexes.filter(index => {
      const fields = (index.fields || []).map(field => field.attribute);
      return index.unique && fields.length === 1 && fields[0] === 'name';
    });

    for (const index of nameOnlyUniqueIndexes) {
      if (index.name) {
        console.log(`Dropping legacy unique index: ${index.name}`);
        await queryInterface.removeIndex(tableName, index.name);
      }
    }

    const refreshedIndexes = (await queryInterface.showIndex(tableName)) as IndexInfo[];
    const hasProgramNameUnique = refreshedIndexes.some(index => {
      if (!index.unique) return false;
      const fields = (index.fields || []).map(field => field.attribute);
      return fields.length === 2 && fields[0] === 'program_id' && fields[1] === 'name';
    });

    if (!hasProgramNameUnique) {
      console.log('Adding unique index on (program_id, name)...');
      await queryInterface.addIndex(tableName, ['program_id', 'name'], {
        unique: true,
        name: targetIndexName,
      });
      console.log('Added unique index on (program_id, name)');
    } else {
      console.log('Unique index on (program_id, name) already exists, skipping');
    }
  } catch (error) {
    console.error('Error fixing location_types unique constraint:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await fixLocationTypesUniqueConstraint();
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

export default fixLocationTypesUniqueConstraint;
