import sequelize from '../src/db/index';

async function dropSessionTypeConstraint() {
  try {
    console.log('Dropping check_session_type constraint from sessions table...');

    const dialect = sequelize.getDialect();

    if (dialect === 'mysql' || dialect === 'mariadb') {
      const [rows] = await sequelize.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'sessions'
           AND CONSTRAINT_TYPE = 'CHECK'
           AND CONSTRAINT_NAME = 'check_session_type'
         LIMIT 1`
      );

      if (Array.isArray(rows) && rows.length > 0) {
        await sequelize.query(
          'ALTER TABLE sessions DROP CHECK check_session_type'
        );
      } else {
        console.log('Constraint check_session_type does not exist, skipping');
      }
    } else {
      await sequelize.query(
        'ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_session_type'
      );
    }

    console.log('Successfully dropped check_session_type constraint');
  } catch (error) {
    console.error('Error dropping check_session_type constraint:', error);
    throw error;
  }
}

async function main() {
  try {
    await dropSessionTypeConstraint();
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

export default dropSessionTypeConstraint;
