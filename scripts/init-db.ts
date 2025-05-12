#!/usr/bin/env ts-node

import { testConnection } from '../src/db';
import syncDatabase from '../src/db/sync';
import pino from 'pino';

const logger = pino();

// Determine if we're running in production
const isProduction = process.env.NODE_ENV === 'production';

async function initializeDatabase() {
  try {
    // 1. Test the database connection
    logger.info('Testing database connection...');
    await testConnection();
    
    // 2. Determine sync options based on environment
    const syncOptions = {
      // In production, we only want to alter tables, not force recreate
      force: !isProduction && process.argv.includes('--force'),
      // Allow structure changes even in production if specified
      alter: process.argv.includes('--alter'),
    };
    
    if (syncOptions.force && isProduction) {
      logger.error('SAFETY ERROR: Cannot use --force in production environment');
      process.exit(1);
    }
    
    // 3. Sync database
    logger.info(`Syncing database with options: ${JSON.stringify(syncOptions)}`);
    await syncDatabase(syncOptions);
    
    logger.info('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase(); 