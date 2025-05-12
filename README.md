# VectorCam API

A Node.js backend API built with TypeScript and Fastify.

## Features

- Built with TypeScript and Fastify
- CORS, Helmet, and Compression middleware
- Structured logging with Pino
- MySQL database integration with Sequelize
- AWS S3 integration
- Modular route structure
- Multiple environment support (development, test, production)

## Prerequisites

- Node.js (v16 or later)
- MySQL
- AWS account (for S3 access)

## Getting Started

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd vectorcam-api
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create environment files:
   
   #### Development (.env.development)
   ```
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
   ```
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
   ```
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

The application can automatically set up your database tables based on the Sequelize models defined. Here's how to initialize your database:

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

   NOTE: The `--force` option will drop all existing tables and data. Use with caution!

3. **Database diagram**: The application uses the following database structure:
   - HealthCenter - Stores health center information
   - Site - Stores site information, linked to health centers
   - Device - Stores device information, linked to sites
   - Session - Records user sessions, linked to devices and sites
   - SurveillanceForm - Stores form data, linked to sessions
   - YoloBox - Stores bounding box coordinates for mosquito detection
   - Specimen - Stores specimen information, linked to sessions and YoloBoxes

### Running the Server

#### Development Mode

```
npm run dev
```

#### Test Mode

```
npm run start:test
```

#### Production Mode

```
npm run build
npm start
```

## Environment Configuration

The application uses different environment configurations based on the `NODE_ENV` value:

- **Development**: Used during local development with verbose logging
- **Test**: Used during testing with minimal logging
- **Production**: Used in production with optimized settings

You can switch between environments using the corresponding npm scripts or by setting the `NODE_ENV` variable.

## API Endpoints

- `GET /`: Welcome endpoint
- `GET /health`: Health check endpoint (shows current environment)
- `GET /health/db`: Database health check endpoint

## Project Structure

```
.
├── src/
│   ├── config/          # Configuration files
│   │   └── environment.ts # Environment-specific configs
│   ├── db/              # Database setup and models
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.ts        # Main application entry point
├── .env.development     # Development environment variables
├── .env.test            # Test environment variables
├── .env.production      # Production environment variables
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md            # Project documentation
```

## Adding New Features

### Adding New Routes

1. Create a new route file in the `src/routes` directory
2. Import and register the route in `src/routes/index.ts`

### Adding New Database Models

1. Create model files in the `src/db/models` directory using the factory pattern
2. Import and initialize models in `src/db/models/index.ts`

## License

[MIT](LICENSE) 