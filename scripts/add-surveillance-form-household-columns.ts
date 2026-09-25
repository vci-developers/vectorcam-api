import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

/**
 * Migration: Add household composition columns to surveillanceforms.
 *
 * - num_children_under_5: number of children under 5 years old in the household
 * - has_pregnant_woman: whether a pregnant woman is present in the household
 *
 * Run with: npx ts-node scripts/add-surveillance-form-household-columns.ts
 */
const TABLE = 'surveillanceforms';

const COLUMNS = [
  {
    name: 'num_children_under_5',
    definition: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    name: 'has_pregnant_woman',
    definition: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
  },
] as const;

async function addSurveillanceFormHouseholdColumns() {
  const qi = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    const tableDefinition = await qi.describeTable(TABLE);
    for (const column of COLUMNS) {
      if (tableDefinition[column.name]) {
        console.log(`Column ${TABLE}.${column.name} already exists. Skipping.`);
        continue;
      }

      console.log(`Adding ${column.name} column to ${TABLE}...`);
      await qi.addColumn(TABLE, column.name, column.definition, { transaction });
      console.log(`Added ${column.name}`);
    }

    await transaction.commit();
    console.log('Migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  try {
    await addSurveillanceFormHouseholdColumns();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default addSurveillanceFormHouseholdColumns;
