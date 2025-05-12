import pino from 'pino';
import { config } from '../config/environment';

// Configure logger based on environment
const logger = pino({
  level: config.server.logLevel || (config.server.nodeEnv === 'production' ? 'info' : 'debug'),
  transport: config.server.nodeEnv !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined,
});

export default logger; 