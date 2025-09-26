import { Sequelize } from 'sequelize';
import * as crypto from 'crypto';
import { readFileSync } from 'fs';
import * as path from 'path';

// Import database and models
import sequelize from '../src/db/index';
import { Program, Site, Device, Session, Specimen, SpecimenImage, InferenceResult } from '../src/db/models';

// Constants for seeding
const SITES_PER_PROGRAM = 10;
const SESSIONS_PER_SITE = 10;
const SPECIMENS_PER_SESSION = 20;

// Sample data arrays
const DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbale', 
  'Gulu', 'Lira', 'Mbarara', 'Kasese', 'Fort Portal'
];

const SUB_COUNTIES = [
  'Central', 'Eastern', 'Western', 'Northern', 'Southern',
  'Kawempe', 'Nakawa', 'Makindye', 'Rubaga', 'Kitante'
];

const PARISHES = [
  'Makerere', 'Mulago', 'Wandegeya', 'Kikoni', 'Kawempe',
  'Ntinda', 'Kamwokya', 'Bukoto', 'Kololo', 'Nakasero'
];

const VILLAGE_NAMES = [
  'Kyebando', 'Bwaise', 'Kazo', 'Kisaasi', 'Kiwatule',
  'Najjera', 'Kira', 'Namugongo', 'Kyanja', 'Kiira'
];

const HEALTH_CENTERS = [
  'Mulago Health Center', 'Kawempe Health Center', 'Kiruddu Health Center',
  'Naguru Health Center', 'Nsambya Health Center', 'Mengo Health Center',
  'Rubaga Health Center', 'Kitante Health Center', 'Nakasero Health Center',
  'Kololo Health Center'
];

const COLLECTOR_NAMES = [
  'Dr. Sarah Nakato', 'Dr. John Mugisha', 'Dr. Mary Nambi', 'Dr. Peter Okello',
  'Dr. Grace Atim', 'Dr. David Ssemakula', 'Dr. Ruth Nalwoga', 'Dr. Moses Kiprotich',
  'Dr. Jane Akello', 'Dr. Samuel Byaruhanga'
];

const COLLECTION_METHODS = [
  'Manual Collection', 'Trap Collection', 'Net Collection', 'Aspiration Method',
  'Light Trap', 'CDC Trap', 'Gravid Trap', 'BG-Sentinel Trap'
];

const SPECIMEN_CONDITIONS = [
  'Excellent', 'Good', 'Fair', 'Poor', 'Damaged'
];

// Valid session types based on database constraint
const SESSION_TYPES = ['SURVEILLANCE', 'DATA_COLLECTION'];

const SPECIES_OPTIONS = [
  'Anopheles gambiae', 'Anopheles arabiensis', 'Anopheles funestus',
  'Aedes aegypti', 'Aedes albopictus', 'Culex quinquefasciatus',
  'Culex pipiens', 'Mansonia uniformis'
];

const SEX_OPTIONS = ['Male', 'Female', 'Unknown'];
const ABDOMEN_STATUS_OPTIONS = ['Unfed', 'Blood-fed', 'Semi-gravid', 'Gravid', 'Unknown'];

// Helper function to generate random date within the past year distributed by month
function generateRandomDateInPastYear(monthIndex: number): Date {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const targetMonth = (startDate.getMonth() + monthIndex) % 12;
  const targetYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + monthIndex) / 12);
  
  const monthStart = new Date(targetYear, targetMonth, 1);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0);
  
  const randomTime = monthStart.getTime() + Math.random() * (monthEnd.getTime() - monthStart.getTime());
  return new Date(randomTime);
}

// Helper function to generate session dates distributed across past year
function generateSessionDatesDistributed(totalSessions: number): Date[] {
  const dates: Date[] = [];
  const sessionsPerMonth = Math.ceil(totalSessions / 12);
  
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const sessionsThisMonth = Math.min(sessionsPerMonth, totalSessions - dates.length);
    
    for (let i = 0; i < sessionsThisMonth; i++) {
      dates.push(generateRandomDateInPastYear(monthIndex));
    }
    
    if (dates.length >= totalSessions) break;
  }
  
  // Shuffle the dates to randomize which sessions get which dates
  for (let i = dates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dates[i], dates[j]] = [dates[j], dates[i]];
  }
  
  return dates.slice(0, totalSessions);
}

// Helper function to generate random number within range
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Helper function to generate random integer within range
function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to get random item from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate a unique fake image as base64 (small PNG with different colors/patterns)
function generateUniqueImageData(specimenId: string, imageIndex: number): { data: string; md5: string; imageKey: string } {
  // Create a deterministic but unique hash for this specific specimen and image
  const hash = crypto.createHash('md5').update(`${specimenId}_${imageIndex}`).digest('hex');
  
  // Create a unique image identifier for the S3 key
  const imageId = `${specimenId.replace(/[^a-zA-Z0-9]/g, '_')}_${imageIndex}`;
  const hashPrefix = hash.substring(0, 8);
  
  // Different base64 PNG patterns representing different "specimen images"
  // These are all small, valid 4x4 pixel PNG images with different patterns
  const imagePatterns = [
    // Red-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWP8//8/AzYwirkTAAAAAElFTkSuQmCC',
    // Green-ish pattern 
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWP4/x8FA3YwirkTAAAAAElFTkSuQmCC',
    // Blue-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY+O8/AzYwirkTAAAAAElFTkSuQmCC',
    // Purple-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY9+8/AzYwirkTAAAAAElFTkSuQmCC',
    // Orange-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY/+8/AzYwirkTAAAAAElFTkSuQmCC',
    // Yellow-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY/O8/AzYwirkTAAAAAElFTkSuQmCC',
    // Cyan-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY8e8/AzYwirkTAAAAAElFTkSuQmCC',
    // Magenta-ish pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY9e8/AzYwirkTAAAAAElFTkSuQmCC',
    // Dark pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY/O8/AzYwirkTAAAAAElFTkSuQmCC',
    // Light pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWPY8+8/AzYwirkTAAAAAElFTkSuQmCC',
    // Mixed pattern 1
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY+u8/AzYwirkTAAAAAElFTkSuQmCC',
    // Mixed pattern 2
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY9u8/AzYwirkTAAAAAElFTkSuQmCC',
    // Gradient pattern 1
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY/e8/AzYwirkTAAAAAElFTkSuQmCC',
    // Gradient pattern 2
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY9e8/AzYwirkTAAAAAElFTkSuQmCC',
    // Spotted pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY8u8/AzYwirkTAAAAAElFTkSuQmCC',
    // Striped pattern
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABklEQVQIHWNY8O8/AzYwirkTAAAAAElFTkSuQmCC'
  ];
  
  // Select pattern based on hash to ensure each specimen gets a unique but deterministic image
  const patternIndex = parseInt(hash.substring(12, 14), 16) % imagePatterns.length;
  const pngData = imagePatterns[patternIndex];
  
  // Create unique MD5 by combining the selected pattern with specimen-specific data
  // This ensures each specimen has a truly unique image hash
  const uniqueData = `${pngData}_${specimenId}_${imageIndex}_${hash}`;
  const md5 = crypto.createHash('md5').update(uniqueData).digest('hex');
  
  // Generate realistic S3 key structure
  const timestamp = Date.now() + parseInt(hash.substring(0, 4), 16); // Add hash-based offset for uniqueness
  const imageKey = `specimens/${imageId}/thumbnail_${timestamp}_${hashPrefix}.png`;
  
  return { data: pngData, md5, imageKey };
}

// Generate inference result logits (fake JSON data)
function generateLogits(): string {
  const logits = Array.from({ length: 8 }, () => randomBetween(-5, 5));
  return JSON.stringify(logits);
}

// Function to clean up existing seeded data
async function cleanupExistingData(transaction: any) {
  console.log('Cleaning up existing seeded data...');
  
  try {
    // Delete in reverse order of dependencies to avoid foreign key constraints
    await sequelize.query('DELETE FROM inference_results WHERE specimen_image_id IN (SELECT id FROM specimen_images WHERE specimen_id IN (SELECT id FROM specimens WHERE session_id IN (SELECT id FROM sessions WHERE device_id IN (SELECT id FROM devices WHERE program_id IN (SELECT id FROM programs WHERE name = ?)))))', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM specimen_images WHERE specimen_id IN (SELECT id FROM specimens WHERE session_id IN (SELECT id FROM sessions WHERE device_id IN (SELECT id FROM devices WHERE program_id IN (SELECT id FROM programs WHERE name = ?))))', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM specimens WHERE session_id IN (SELECT id FROM sessions WHERE device_id IN (SELECT id FROM devices WHERE program_id IN (SELECT id FROM programs WHERE name = ?)))', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM sessions WHERE device_id IN (SELECT id FROM devices WHERE program_id IN (SELECT id FROM programs WHERE name = ?))', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM sites WHERE program_id IN (SELECT id FROM programs WHERE name = ?)', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM devices WHERE program_id IN (SELECT id FROM programs WHERE name = ?)', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    await sequelize.query('DELETE FROM programs WHERE name = ?', {
      replacements: ['Uganda Vector Surveillance Program'],
      transaction
    });
    
    console.log('✅ Existing seeded data cleaned up successfully');
  } catch (error) {
    console.log('ℹ️  No existing seeded data found or cleanup not needed');
  }
}

async function seedSpecimens() {
  try {
    console.log('Starting specimen seeding process...');

    // Check if database is connected
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Clean up any existing seeded data first
      await cleanupExistingData(transaction);
      
      // Create 1 Program
      console.log('Creating program...');
      const program = await Program.create({
        name: 'Uganda Vector Surveillance Program',
        country: 'Uganda'
      }, { transaction });
      console.log(`Created program: ${program.name} (ID: ${program.id})`);

      // Create a device for this program
      console.log('Creating device...');
      const device = await Device.create({
        model: 'VectorCam Mobile',
        registeredAt: new Date(),
        programId: program.id
      }, { transaction });
      console.log(`Created device: ${device.model} (ID: ${device.id})`);

      // Create 10 Sites
      console.log('Creating sites...');
      const sites: Site[] = [];
      for (let siteIndex = 0; siteIndex < SITES_PER_PROGRAM; siteIndex++) {
        const site = await Site.create({
          programId: program.id,
          district: getRandomItem(DISTRICTS),
          subCounty: getRandomItem(SUB_COUNTIES),
          parish: getRandomItem(PARISHES),
          villageName: getRandomItem(VILLAGE_NAMES),
          houseNumber: `H${siteIndex + 1}${randomIntBetween(10, 99)}`,
          isActive: true,
          healthCenter: getRandomItem(HEALTH_CENTERS)
        }, { transaction });
        sites.push(site);
        console.log(`Created site ${siteIndex + 1}/10: ${site.district} - ${site.villageName} (ID: ${site.id})`);
      }

      // Create Sessions, Specimens, and Images
      console.log('Creating sessions, specimens, and images...');
      let totalSpecimens = 0;
      let totalImages = 0;
      let totalInferenceResults = 0;

      // Generate collection dates distributed across the past year
      const totalSessions = SITES_PER_PROGRAM * SESSIONS_PER_SITE;
      const sessionDates = generateSessionDatesDistributed(totalSessions);
      let sessionDateIndex = 0;

      for (const site of sites) {
        // Create 10 Sessions per Site
        for (let sessionIndex = 0; sessionIndex < SESSIONS_PER_SITE; sessionIndex++) {
          const sessionCollectionDate = sessionDates[sessionDateIndex++];
          const session = await Session.create({
            frontendId: `session_${site.id}_${sessionIndex + 1}_${Date.now()}`,
            collectorTitle: 'Dr.',
            collectorName: getRandomItem(COLLECTOR_NAMES),
            collectionDate: sessionCollectionDate,
            collectionMethod: getRandomItem(COLLECTION_METHODS),
            specimenCondition: getRandomItem(SPECIMEN_CONDITIONS),
            submittedAt: sessionCollectionDate,
            notes: `Collection session ${sessionIndex + 1} at ${site.villageName}`,
            siteId: site.id,
            deviceId: device.id,
            latitude: randomBetween(-1.5, 4.5), // Uganda latitude range
            longitude: randomBetween(29.5, 35.0), // Uganda longitude range
            type: getRandomItem(SESSION_TYPES),
            createdAt: sessionCollectionDate,
            updatedAt: sessionCollectionDate
          }, { transaction });

          // Create 20 Specimens per Session
          for (let specimenIndex = 0; specimenIndex < SPECIMENS_PER_SESSION; specimenIndex++) {
            // Use the session's collection date for specimen timestamps
            // Add a small random offset (0-6 hours) to simulate collection throughout the day
            const specimenTimestamp = new Date(sessionCollectionDate.getTime() + Math.random() * 6 * 60 * 60 * 1000);

            const specimen = await Specimen.create({
              specimenId: `SPEC_${site.id}_${session.id}_${specimenIndex + 1}`,
              sessionId: session.id,
              createdAt: specimenTimestamp,
              updatedAt: specimenTimestamp
            }, { transaction });

            totalSpecimens++;

            // Generate unique fake image data for this specimen
            const imageData = generateUniqueImageData(specimen.specimenId, 0);
            
            // Create SpecimenImage (thumbnail)
            const specimenImage = await SpecimenImage.create({
              specimenId: specimen.id,
              imageKey: imageData.imageKey,
              filemd5: imageData.md5,
              species: getRandomItem(SPECIES_OPTIONS),
              sex: getRandomItem(SEX_OPTIONS),
              abdomenStatus: getRandomItem(ABDOMEN_STATUS_OPTIONS),
              capturedAt: specimenTimestamp,
              createdAt: specimenTimestamp,
              updatedAt: specimenTimestamp
            }, { transaction });

            totalImages++;

            // Update specimen to reference this image as thumbnail
            await specimen.update({
              thumbnailImageId: specimenImage.id
            }, { transaction });

            // Create InferenceResult for the image
            const inferenceResult = await InferenceResult.create({
              specimenImageId: specimenImage.id,
              bboxTopLeftX: randomBetween(0, 200),
              bboxTopLeftY: randomBetween(0, 200),
              bboxWidth: randomBetween(50, 300),
              bboxHeight: randomBetween(50, 300),
              speciesLogits: generateLogits(),
              sexLogits: generateLogits(),
              abdomenStatusLogits: generateLogits(),
              bboxConfidence: randomBetween(0.5, 0.99),
              bboxClassId: randomIntBetween(0, 7),
              speciesInferenceDuration: randomIntBetween(50, 500),
              sexInferenceDuration: randomIntBetween(30, 300),
              abdomenStatusInferenceDuration: randomIntBetween(30, 300),
              bboxDetectionDuration: randomIntBetween(100, 1000),
              createdAt: specimenTimestamp,
              updatedAt: specimenTimestamp
            }, { transaction });

            totalInferenceResults++;
          }

          console.log(`Created session ${sessionIndex + 1}/10 for site ${site.id} with ${SPECIMENS_PER_SESSION} specimens`);
        }
      }

      // Commit transaction
      await transaction.commit();

      console.log('\n=== Seeding Summary ===');
      console.log(`✅ Programs created: 1`);
      console.log(`✅ Devices created: 1`);
      console.log(`✅ Sites created: ${SITES_PER_PROGRAM}`);
      console.log(`✅ Sessions created: ${SITES_PER_PROGRAM * SESSIONS_PER_SITE}`);
      console.log(`✅ Specimens created: ${totalSpecimens}`);
      console.log(`✅ Specimen images created: ${totalImages}`);
      console.log(`✅ Inference results created: ${totalInferenceResults}`);
      console.log(`✅ Date distribution: Sessions evenly distributed across past 12 months`);
      console.log('✅ Seeding completed successfully!');

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      console.error('Error during seeding, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error in seeding process:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

// Run the seeding function
if (require.main === module) {
  seedSpecimens()
    .then(() => {
      console.log('Seeding script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding script failed:', error);
      process.exit(1);
    });
}

export default seedSpecimens;
