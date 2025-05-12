import sequelize from './index';
import pino from 'pino';

require('./models');

const logger = pino();

/**
 * Synchronize database schema with models
 * 
 * **IMPORTANT:**
 * **Only run this in local non production as operation can be destructive!**
 * 
 * Options:
 * - force: If true, it will drop tables before recreating them
 * - alter: If true, it will modify tables to match models
 */
async function syncDatabase(options = { force: false, alter: false }) {
  // if (process.env.DB_HOST?.includes('amazonaws')) {
  //   console.error('Should only run this in local non production as operation can be destructive!');
  //   return process.exit();
  // }

  try {
    logger.info(`Starting database sync with options: ${JSON.stringify(options)}`);
    
    // Sync all models with database
    await sequelize.sync(options);
    
    logger.info('Database sync completed successfully');
    return true;
  } catch (error) {
    logger.error('Error syncing database:', error);
    throw error;
  } 
}

// Only run if called directly (not imported)
if (require.main === module) {
  // Check for command line arguments
  const force = process.argv.includes('--force');
  const alter = process.argv.includes('--alter');
  
  if (force) {
    logger.warn('WARNING: Running sync with --force will DROP ALL TABLES and recreate them');
  }
  
  syncDatabase({ force, alter })
    .then(() => {
      logger.info('Database sync script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database sync script failed:', error);
      process.exit(1);
    });
}

export default syncDatabase; 