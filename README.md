# VectorCam API

A Node.js backend API built with TypeScript and Fastify for mosquito surveillance and specimen management.

## Overview

VectorCam API is a comprehensive backend service designed to support mosquito surveillance programs. It provides endpoints for managing programs, sites, devices, sessions, specimens, and associated images with AWS S3 integration for file storage.

## Features

- **Fast & Lightweight**: Built with TypeScript and Fastify for high performance
- **Security**: CORS, Helmet, and Compression middleware for enhanced security
- **Structured Logging**: Comprehensive logging with Pino
- **Database Integration**: MySQL database with Sequelize ORM
- **File Storage**: AWS S3 integration for specimen image storage
- **Multipart Uploads**: Support for large file uploads with multipart upload API
- **API Documentation**: Interactive Swagger UI documentation
- **Modular Architecture**: Clean separation of concerns with modular route structure
- **Environment Support**: Multiple environment configurations (development, test, production)

## Prerequisites

- Node.js (v16 or later)
- MySQL (v8.0 or later)
- AWS account (for S3 access)

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vectorcam-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment files:
   
   #### Development (.env.development)
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=vectorcam
   DB_USER=root
   DB_PASSWORD=password

   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_dev_access_key
   AWS_SECRET_ACCESS_KEY=your_dev_secret_key
   S3_BUCKET_NAME=your-dev-bucket-name
   ```

   #### Test (.env.test)
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=test

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=vectorcam_test
   DB_USER=root
   DB_PASSWORD=password

   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_test_access_key
   AWS_SECRET_ACCESS_KEY=your_test_secret_key
   S3_BUCKET_NAME=your-test-bucket-name
   ```

   #### Production (.env.production)
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=production

   # Database Configuration
   DB_HOST=your_production_host
   DB_PORT=3306
   DB_NAME=vectorcam_prod
   DB_USER=your_db_user
   DB_PASSWORD=your_secure_password

   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_prod_access_key
   AWS_SECRET_ACCESS_KEY=your_prod_secret_key
   S3_BUCKET_NAME=your-prod-bucket-name
   ```

### Database Setup

The application uses Sequelize ORM with MySQL. Here's how to set up your database:

1. **Create the database**: First, create your MySQL database manually:
   ```bash
   mysql -u your_username -p
   # Enter your password when prompted
   
   # In MySQL console
   CREATE DATABASE vectorcam;
   CREATE DATABASE vectorcam_test;
   # Exit MySQL console
   exit;
   ```

2. **Initialize database tables**: Use the built-in database initialization scripts:
   ```bash
   # Regular initialization (preserves existing tables)
   npm run db:init
   
   # Initialization with structure changes (alters tables to match models)
   npm run db:init:alter
   
   # Force initialization (drops and recreates all tables - CAUTION!)
   npm run db:init:force
   ```

   ⚠️ **Warning**: The `--force` option will drop all existing tables and data. Use with caution!

3. **Database Schema**: The application uses the following database structure:
   - **Program**: Manages surveillance programs
   - **Site**: Stores site information, linked to programs
   - **Device**: Stores device information, linked to sites
   - **Session**: Records user sessions, linked to devices and sites
   - **SurveillanceForm**: Stores form data, linked to sessions
   - **Specimen**: Stores specimen information, linked to sessions
   - **SpecimenImage**: Stores specimen image metadata, linked to specimens
   - **InferenceResult**: Stores AI inference results
   - **MultipartUpload**: Manages multipart upload sessions for large files

### Running the Server

#### Development Mode
```bash
npm run dev
```

#### Test Mode
```bash
npm run dev:test
```

#### Production Mode
```bash
npm run build
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run dev:test` - Start test environment server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run start:dev` - Start development server (built version)
- `npm run start:test` - Start test server (built version)
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run db:init` - Initialize database tables
- `npm run db:init:force` - Force initialize database (drops existing tables)
- `npm run db:init:alter` - Initialize database with alterations

## API Endpoints

### Health Endpoints
- `GET /` - Welcome endpoint
- `GET /health` - Health check endpoint (shows current environment)
- `GET /health/db` - Database health check endpoint

### Programs
- `POST /programs` - Create a new program
- `GET /programs` - Get paginated list of programs
- `GET /programs/:program_id` - Get program details
- `PUT /programs/:program_id` - Update program
- `DELETE /programs/:program_id` - Delete program

### Sites
- `POST /sites` - Create a new site
- `GET /sites` - Get paginated list of sites
- `GET /sites/:site_id` - Get site details
- `PUT /sites/:site_id` - Update site
- `DELETE /sites/:site_id` - Delete site

### Devices
- `POST /devices` - Create a new device
- `GET /devices` - Get paginated list of devices
- `GET /devices/:device_id` - Get device details
- `PUT /devices/:device_id` - Update device
- `DELETE /devices/:device_id` - Delete device

### Sessions
- `POST /sessions` - Create a new session
- `GET /sessions` - Get paginated list of sessions
- `GET /sessions/:session_id` - Get session details
- `PUT /sessions/:session_id` - Update session
- `DELETE /sessions/:session_id` - Delete session
- `GET /sessions/users/:user_id` - Get sessions by user
- `GET /sessions/sites/:site_id` - Get sessions by site
- `GET /sessions/:session_id/specimens` - Get specimens for a session
- `GET /sessions/:session_id/survey` - Get session surveillance form
- `POST /sessions/:session_id/survey` - Submit surveillance form
- `PUT /sessions/:session_id/survey` - Update surveillance form
- `GET /sessions/export/csv` - Export sessions as CSV

### Specimens
- `POST /specimens` - Create a new specimen
- `GET /specimens` - Get paginated list of specimens
- `GET /specimens/:specimen_id` - Get specimen details
- `PUT /specimens/:specimen_id` - Update specimen

#### Specimen Images
- `POST /specimens/:specimen_id/images` - Upload specimen image
- `GET /specimens/:specimen_id/images` - Get all specimen images
- `GET /specimens/:specimen_id/images/:image_id` - Get specific specimen image

#### Multipart Uploads (for large files)
- `POST /specimens/:specimen_id/images/uploads` - Initiate multipart upload
- `PUT /specimens/:specimen_id/images/uploads/:upload_id` - Append bytes to upload
- `POST /specimens/:specimen_id/images/uploads/:upload_id/complete` - Complete multipart upload
- `GET /specimens/:specimen_id/images/uploads` - Get upload list
- `GET /specimens/:specimen_id/images/uploads/:upload_id` - Get upload details

### Documentation
- `GET /documentation` - Interactive API documentation (Swagger UI)

## Project Structure

```
vectorcam-api/
├── src/
│   ├── config/              # Configuration files
│   │   └── environment.ts   # Environment-specific configs
│   ├── db/                  # Database setup and models
│   │   ├── models/          # Sequelize models
│   │   ├── index.ts         # Database connection
│   │   └── sync.ts          # Database synchronization
│   ├── handlers/            # Request handlers
│   │   ├── program/         # Program CRUD operations
│   │   ├── site/            # Site CRUD operations
│   │   ├── device/          # Device CRUD operations
│   │   ├── session/         # Session CRUD operations
│   │   └── specimen/        # Specimen CRUD operations
│   ├── middleware/          # Custom middleware
│   ├── routes/              # API routes
│   ├── services/            # Business logic services
│   │   └── s3.service.ts    # AWS S3 integration
│   ├── utils/               # Utility functions
│   │   └── logger.ts        # Logging configuration
│   └── server.ts            # Main application entry point
├── scripts/
│   └── init-db.ts           # Database initialization script
├── logs/                    # Application logs
├── .env.development         # Development environment variables
├── .env.test                # Test environment variables
├── .env.production          # Production environment variables
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project documentation
```

## Environment Configuration

The application uses different environment configurations based on the `NODE_ENV` value:

- **Development**: Used during local development with verbose logging and hot reload
- **Test**: Used during testing with minimal logging
- **Production**: Used in production with optimized settings and security headers

You can switch between environments using the corresponding npm scripts or by setting the `NODE_ENV` variable.

## Key Dependencies

### Production Dependencies
- **Fastify**: High-performance web framework
- **Sequelize**: ORM for database operations
- **MySQL2**: MySQL driver
- **AWS SDK**: S3 integration for file storage
- **Pino**: Structured logging
- **Swagger**: API documentation

### Development Dependencies
- **TypeScript**: Type safety and modern JavaScript features
- **ESLint**: Code linting
- **Jest**: Testing framework
- **ts-node-dev**: Development server with hot reload

## Contributing

### Adding New Features

#### Adding New Routes
1. Create a new route file in the `src/routes` directory
2. Create corresponding handlers in the `src/handlers` directory
3. Import and register the route in `src/routes/index.ts`

#### Adding New Database Models
1. Create model files in the `src/db/models` directory using the factory pattern
2. Import and initialize models in `src/db/models/index.ts`
3. Update the database initialization script if needed

#### Adding New Services
1. Create service files in the `src/services` directory
2. Follow the existing service patterns for consistency

## License

[MIT](LICENSE) 