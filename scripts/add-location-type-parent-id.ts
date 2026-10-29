import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addParentIdColumn() {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('location_types');
  if ('parent_id' in table) {
    console.log('parent_id column already exists, skipping add');
    return;
  }
  await qi.addColumn('location_types', 'parent_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'location_types',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });
}

async function backfillParentIds() {
  await sequelize.query(`
    UPDATE location_types
    SET parent_id = NULL
    WHERE level <= 1
  `);

  // MySQL rejects UPDATE ... SET col = (SELECT ... FROM same_table); use a join instead.
  const [, meta] = await sequelize.query(`
    UPDATE location_types AS child
    INNER JOIN (
      SELECT
        c.id AS child_id,
        p.id AS parent_id
      FROM location_types AS c
      INNER JOIN (
        SELECT program_id, level, MIN(id) AS id
        FROM location_types
        GROUP BY program_id, level
      ) AS p
        ON p.program_id = c.program_id
       AND p.level = c.level - 1
      WHERE c.level > 1
    ) AS mapping ON mapping.child_id = child.id
    SET child.parent_id = mapping.parent_id
  `);

  const updatedCount = typeof meta === 'object' && meta !== null && 'affectedRows' in meta
    ? (meta as { affectedRows?: number }).affectedRows
    : undefined;
  console.log(`Backfilled parent_id for ${updatedCount ?? 'all eligible'} location type row(s)`);
}

async function main() {
  try {
    console.log('Adding parent_id column to location_types...');
    await addParentIdColumn();
    console.log('Backfilling parent_id from level hierarchy...');
    await backfillParentIds();
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
