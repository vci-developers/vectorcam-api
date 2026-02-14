import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addLevelColumn() {
  const qi = sequelize.getQueryInterface();
  await qi.addColumn('location_types', 'level', {
    type: DataTypes.INTEGER,
    allowNull: true, // temporarily nullable for backfill
  });
}

async function backfillLevels() {
  // Get distinct program IDs that have location types
  const programs = await sequelize.query<{ program_id: number }>(
    'SELECT DISTINCT program_id FROM location_types ORDER BY program_id',
    { type: QueryTypes.SELECT }
  );

  for (const { program_id } of programs) {
    // Get location types for this program ordered by ID
    const locationTypes = await sequelize.query<{ id: number }>(
      'SELECT id FROM location_types WHERE program_id = :program_id ORDER BY id ASC',
      { replacements: { program_id }, type: QueryTypes.SELECT }
    );

    // Assign levels 1, 2, 3... based on ID order
    for (let i = 0; i < locationTypes.length; i++) {
      await sequelize.query(
        'UPDATE location_types SET level = :level WHERE id = :id',
        { replacements: { level: i + 1, id: locationTypes[i].id } }
      );
    }

    console.log(`Program ${program_id}: assigned levels to ${locationTypes.length} location types`);
  }
}

async function makeLevelNotNull() {
  const qi = sequelize.getQueryInterface();
  await qi.changeColumn('location_types', 'level', {
    type: DataTypes.INTEGER,
    allowNull: false,
  });
}

async function main() {
  try {
    console.log('Adding level column to location_types...');
    await addLevelColumn();
    console.log('Backfilling levels based on ID order per program...');
    await backfillLevels();
    console.log('Making level column NOT NULL...');
    await makeLevelNotNull();
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

export default main;
