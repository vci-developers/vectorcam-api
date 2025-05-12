import { Sequelize } from 'sequelize';
import { config } from '../config/environment';
import pino from 'pino';
import initModels from './models';

const logger = pino();

// Initialize Sequelize with database configuration
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
  logging: config.db.logging ? (msg: string) => logger.debug(msg) : false,
  dialectOptions: { decimalNumbers: true, multipleStatements: true },
  pool: {
    max: 60, // The maximum number of connections able to acquire. Further queries will be queued.
  },
});

// Initialize models
const models = initModels(sequelize);

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

export { models };
export default sequelize; 