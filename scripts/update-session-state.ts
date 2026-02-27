import sequelize from '../src/db/index';

async function UpdateSessionState() {
  try {

    console.log('Updating state to NOT_APPLICABLE for non-SURVEILLANCE sessions...');

    const [, meta] = await sequelize.query(
      "UPDATE sessions SET state = 'NOT_APPLICABLE' WHERE type != 'SURVEILLANCE' AND type != ''"
    );

    console.log(`Updated ${(meta as any).rowCount ?? (meta as any).changes ?? 0} session(s) to NOT_APPLICABLE`);
  } catch (error) {
    console.error('Error running migration:', error);
    throw error;
  }
}

async function main() {
  try {
    await UpdateSessionState();
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

export default UpdateSessionState;
