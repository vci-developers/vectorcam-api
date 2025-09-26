# Database Scripts

This directory contains various database utility scripts for the VectorCam API.

## Available Scripts

### Database Initialization
- `npm run db:init` - Initialize database tables
- `npm run db:init:force` - Force recreate all tables (WARNING: destroys existing data)
- `npm run db:init:alter` - Alter existing tables to match current schema

### Data Seeding
- `npm run db:seed:specimens` - Seed database with sample specimen data

## Seeding Script: `seed-specimens.ts`

### Overview
Creates a comprehensive dataset for testing and development purposes with:

- **1 Program**: "Uganda Vector Surveillance Program"
- **1 Device**: "VectorCam Mobile" device
- **10 Sites**: Distributed across different Ugandan districts
- **100 Sessions**: 10 sessions per site
- **2000 Specimens**: 20 specimens per session
- **2000 Specimen Images**: 1 thumbnail image per specimen
- **2000 Inference Results**: AI analysis results for each image

### Data Distribution
- **Temporal**: Sessions are distributed evenly across the past 12 months, with specimens matching their session dates
- **Geographic**: Sites cover various districts, sub-counties, parishes, and villages in Uganda
- **Scientific**: Includes realistic mosquito species, sex classifications, and abdomen status

### Sample Data Includes
- **Species**: Anopheles gambiae, Aedes aegypti, Culex quinquefasciatus, etc.
- **Collection Methods**: Manual collection, trap collection, net collection, etc.
- **Locations**: Real Ugandan geographic locations
- **Health Centers**: Associated health facilities
- **Collectors**: Sample researcher names and titles

### Running the Script

```bash
# Make sure your database is initialized first
npm run db:init

# Run the seeding script
npm run db:seed:specimens
```

### Important Notes
- **Automatic Cleanup**: Automatically removes any existing seeded data before creating new data
- **Transaction Safety**: The entire seeding process runs in a single database transaction
- **Rollback Protection**: If any error occurs, all changes are automatically rolled back
- **Unique Images**: Uses small 4x4 pixel PNG images with 16 different patterns/colors (base64 encoded)
- **Image Diversity**: Each specimen gets a unique image based on its ID, ensuring visual variety
- **Realistic Data**: All data follows realistic patterns and constraints
- **Performance**: Seeds 2000+ records efficiently in a single operation

### Output
The script provides detailed progress logging and a summary:
```
=== Seeding Summary ===
✅ Programs created: 1
✅ Devices created: 1  
✅ Sites created: 10
✅ Sessions created: 100
✅ Specimens created: 2000
✅ Specimen images created: 2000
✅ Inference results created: 2000
✅ Date distribution: Sessions evenly distributed across past 12 months
✅ Seeding completed successfully!
```

### Troubleshooting
- Ensure your database connection is properly configured
- Make sure all required tables exist (run `npm run db:init` first)
- Check that you have sufficient database permissions
- Review console output for specific error messages

### Development Notes
- All model associations are properly handled [[memory:7526850]]
- Uses TypeScript for type safety
- Follows the existing codebase patterns and conventions
- Generates realistic test data for comprehensive testing scenarios
