import sequelize from '../src/db/index';

const TABLE = 'specimen_images';

const COLUMN_MIGRATIONS = [
  { legacyName: 'original_species', appName: 'app_species' },
  { legacyName: 'original_sex', appName: 'app_sex' },
  { legacyName: 'original_abdomen_status', appName: 'app_abdomen_status' },
] as const;

async function ensureAppPredictionColumn(
  columnNames: Set<string>,
  legacyName: string,
  appName: string
): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();

  if (columnNames.has(appName)) {
    console.log(`✓ Column ${appName} already exists, skipping`);
    return;
  }

  if (columnNames.has(legacyName)) {
    console.log(`Renaming ${legacyName} → ${appName}...`);
    await queryInterface.renameColumn(TABLE, legacyName, appName);
    console.log(`✓ Renamed ${legacyName} to ${appName}`);
    columnNames.delete(legacyName);
    columnNames.add(appName);
    return;
  }

  console.log(`Adding ${appName} column...`);
  await queryInterface.addColumn(TABLE, appName, {
    type: 'VARCHAR(255)',
    allowNull: true,
  });
  console.log(`✓ Added ${appName} column`);
  columnNames.add(appName);
}

async function migrateSpecimenImageAppPredictionColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log(`Migrating app prediction columns on ${TABLE}...`);
    const tableDescription = await queryInterface.describeTable(TABLE);
    const columnNames = new Set(Object.keys(tableDescription));

    for (const { legacyName, appName } of COLUMN_MIGRATIONS) {
      await ensureAppPredictionColumn(columnNames, legacyName, appName);
    }

    console.log('App prediction column migration completed successfully');
  } catch (error) {
    console.error('Error migrating app prediction columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

migrateSpecimenImageAppPredictionColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
