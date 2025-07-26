import dotenv from 'dotenv';
import { join } from 'path';
import fs from 'fs';

// Determine which environment file to load based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
const envPath = join(__dirname, `../../.env.${environment}`);

// If the specific environment file exists, load it
// Otherwise, fall back to the default .env file
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

// Configuration for development environment
const developmentConfig = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: 'development',
    logLevel: 'debug',
    domain: process.env.DOMAIN || 'http://localhost:8080',
  },
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN,
    environment: 'development',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'vectorcam',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    logging: true,
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME || 'vectorcam-dev',
  },
  adminAuthToken: process.env.ADMIN_AUTH_TOKEN,
};

// Configuration for test environment
const testConfig = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: 'test',
    logLevel: 'error',
    domain: process.env.DOMAIN || 'https://api.vectorcam.org',
  },
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN,
    environment: 'test',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'vectorcam_test',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: false,
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME || 'vectorcam-test',
  },
  adminAuthToken: process.env.ADMIN_AUTH_TOKEN,
};

// Configuration for production environment
const productionConfig = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: 'production',
    logLevel: 'info',
    domain: process.env.DOMAIN || 'https://api.vectorcam.org',
  },
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false,
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,
  },
  adminAuthToken: process.env.ADMIN_AUTH_TOKEN,
};

// Select the appropriate configuration based on the environment
const configs = {
  development: developmentConfig,
  test: testConfig,
  production: productionConfig,
};

export const config = configs[environment as keyof typeof configs] || developmentConfig; 