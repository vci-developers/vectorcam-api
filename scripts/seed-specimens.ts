/**
 * Seeding Script for VectorCam API
 * 
 * This script seeds the database with realistic test data for the last 3 months.
 * 
 * Features:
 * - Dynamically reads all mosquito images from /static/assets and uploads them to S3
 * - Supports JPEG, PNG, GIF, and WebP image formats
 * - Uses the uploaded images repeatedly for all specimens
 * - Fetches real data from DHIS2 (districts, villages, health centers, house numbers) using native HTTPS
 * - Uses 5 hardcoded health centers from different districts (Mayuge, Arua, etc.)
 * - Creates 4 sites per health center (20 sites total)
 * - Generates sessions for the most recent 3 months
 * - All sessions are SURVEILLANCE type with surveillance forms
 * - Creates one surveillance form per session with random realistic data (IRS, LLIN info, household data)
 * - Creates 3 sites with multiple sessions (2-5 sessions) to test duplicate submission handling
 * - Of those 3 sites: 1 has matching values (no conflicts), 2 have conflicting values
 * - Each session has 5-15 specimens (with a couple having 0 specimens)
 * - Specimen IDs follow format: ABC123 (3 letters + 3 numbers)
 * - Valid species/sex/abdomen combinations:
 *   - Non mosquito: no sex or abdomen status
 *   - Male: no abdomen status
 *   - Female: has abdomen status
 * - Deletes ALL existing program data before seeding (programs, sites, sessions, specimens, etc.)
 * - Preserves users but removes their site associations
 * 
 * Requirements:
 * - Local mosquito images in /static/assets directory
 * - AWS S3 credentials configured for uploading images
 * - DHIS2 credentials for fetching organization units and TEIs
 * 
 * Run with: npm run db:seed:specimens or npx ts-node scripts/seed-specimens.ts
 */

import { Sequelize } from 'sequelize';
import * as crypto from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import * as https from 'https';

// Import database and models
import sequelize from '../src/db/index';
import { Program, Site, Device, Session, Specimen, SpecimenImage, InferenceResult, SurveillanceForm } from '../src/db/models';
import { config } from '../src/config/environment';
import { uploadFile } from '../src/services/s3.service';

// Sample data arrays for fallback
const COLLECTOR_TITLES = [
  'Village Health Team (VHT)',
  'Vector Control Officer (VCO)',
  'Field Operations Team (FOT)'
];

const COLLECTION_METHODS = [
  'Pyrethrum Spray Catch (PSC)',
  'CDC Light Trap (LTC)'
];

const SPECIMEN_CONDITIONS = [
  'Fresh',
  'Dessicated'
];

// Valid session types based on database constraint
const SESSION_TYPES = ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'];

const SPECIES_OPTIONS = [
  'Anopheles gambiae',
  'Anopheles funestus',
  'Anopheles other',
  'Culex',
  'Aedes',
  'Mansonia',
  'Non mosquito'
];

const SEX_OPTIONS = ['Male', 'Female'];
const ABDOMEN_STATUS_OPTIONS = ['Unfed', 'Full fed', 'Gravid'];

// Surveillance form data options - fixed values
const LLIN_TYPE = 'Pyrethroid + PBO';
const LLIN_BRAND = 'OLYSET';

interface SiteConfig {
  district: string;
  villageName: string;
  houseNumber: string;
  healthCenter: string;
  subCounty?: string;
  parish?: string;
  orgUnit?: string;
  sessionsCount: number; // Number of sessions for this site
  hasConflict: boolean; // Whether sessions should have conflicting values
}

interface UploadedImage {
  imageKey: string;
  md5: string;
  buffer: Buffer;
}

// Helper function to generate random date within a specific month
function generateRandomDateInMonth(year: number, month: number): Date {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  
  const randomTime = monthStart.getTime() + Math.random() * (monthEnd.getTime() - monthStart.getTime());
  return new Date(randomTime);
}

// Helper function to get the last 3 months (year, month pairs)
function getLastThreeMonths(): Array<{year: number, month: number}> {
  const months: Array<{year: number, month: number}> = [];
  const now = new Date();
  
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth()
    });
  }
  
  return months;
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

// Helper function to make HTTPS requests (replacement for fetch)
function httpsRequest(url: string, authHeader: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Helper function to read local mosquito images and upload to S3
async function uploadLocalMosquitoImages(): Promise<UploadedImage[]> {
  console.log('Reading local mosquito images from /static/assets and uploading to S3...');
  const uploadedImages: UploadedImage[] = [];
  const assetsDir = path.join(__dirname, '..', 'static', 'assets');

  // Dynamically read all image files from the assets directory
  const imageFiles = readdirSync(assetsDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  if (imageFiles.length === 0) {
    throw new Error(`No image files found in ${assetsDir}`);
  }

  console.log(`Found ${imageFiles.length} image file(s) in /static/assets`);

  for (let i = 0; i < imageFiles.length; i++) {
    try {
      const filename = imageFiles[i];
      const filePath = path.join(assetsDir, filename);
      
      console.log(`  Reading image ${i + 1}/${imageFiles.length}: ${filename}...`);
      
      // Read the image file
      const imageBuffer = readFileSync(filePath);
      
      // Generate MD5 hash
      const md5 = crypto.createHash('md5').update(imageBuffer).digest('hex');
      
      // Generate S3 key
      const timestamp = Date.now();
      const ext = path.extname(filename);
      const imageKey = `specimens/seed_mosquito_${i + 1}_${timestamp}${ext}`;
      
      // Determine content type
      const contentType = ext === '.png' ? 'image/png' : 
                         ext === '.gif' ? 'image/gif' :
                         ext === '.webp' ? 'image/webp' : 'image/jpeg';
      
      // Upload to S3
      console.log(`  Uploading image ${i + 1} to S3...`);
      await uploadFile(imageKey, imageBuffer, contentType);
      
      uploadedImages.push({
        imageKey,
        md5,
        buffer: imageBuffer
      });
      
      console.log(`  ✅ Image ${i + 1} uploaded successfully`);
    } catch (error) {
      console.error(`  ⚠️  Failed to read/upload image ${i + 1}:`, error);
      // Continue with other images even if one fails
    }
  }

  if (uploadedImages.length === 0) {
    throw new Error('Failed to read and upload any mosquito images');
  }

  console.log(`✅ Successfully uploaded ${uploadedImages.length} local mosquito images to S3`);
  return uploadedImages;
}

// Helper function to generate specimen ID (3 letters + 3 numbers)
function generateSpecimenId(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  const letter3 = letters[Math.floor(Math.random() * letters.length)];
  const numbers = String(index % 1000).padStart(3, '0');
  return `${letter1}${letter2}${letter3}${numbers}`;
}

// Helper function to get valid sex/abdomen combinations for species
function getValidSpecimenAttributes(species: string): { sex: string | null, abdomenStatus: string | null } {
  // Non mosquito: no sex or abdomen status
  if (species === 'Non mosquito') {
    return { sex: null, abdomenStatus: null };
  }
  
  // Male: no abdomen status
  if (Math.random() < 0.5) {
    return { sex: 'Male', abdomenStatus: null };
  }
  
  // Female: has abdomen status
  return {
    sex: 'Female',
    abdomenStatus: getRandomItem(ABDOMEN_STATUS_OPTIONS)
  };
}

// Helper function to generate random surveillance form data
function generateSurveillanceFormData() {
  const numPeopleSleptInHouse = randomIntBetween(1, 10);
  const wasIrsConducted = Math.random() < 0.4; // 40% chance IRS was conducted
  const numLlinsAvailable = randomIntBetween(0, 6);
  
  // Validation rules:
  // 1. If wasIrsConducted is true, monthsSinceIrs MUST be present and be a number
  // 2. If numLlinsAvailable > 0, llinBrand, llinType, and numPeopleSleptUnderLlin are REQUIRED
  
  return {
    numPeopleSleptInHouse,
    wasIrsConducted,
    // If IRS was conducted, monthsSinceIrs is REQUIRED (1-24 months)
    monthsSinceIrs: wasIrsConducted ? randomIntBetween(1, 24) : null,
    numLlinsAvailable,
    // If nets are available, type and brand are REQUIRED (always use fixed values)
    llinType: numLlinsAvailable > 0 ? LLIN_TYPE : null,
    llinBrand: numLlinsAvailable > 0 ? LLIN_BRAND : null,
    // If nets are available, numPeopleSleptUnderLlin is REQUIRED (at least 1, up to number of people)
    numPeopleSleptUnderLlin: numLlinsAvailable > 0 ? randomIntBetween(1, numPeopleSleptInHouse) : null
  };
}

// Helper function to get image data from uploaded images array
function getImageDataFromUploaded(uploadedImages: UploadedImage[], index: number): { imageKey: string; md5: string } {
  const imageIndex = index % uploadedImages.length;
  return {
    imageKey: uploadedImages[imageIndex].imageKey,
    md5: uploadedImages[imageIndex].md5
  };
}

// Generate inference result logits (fake JSON data)
function generateLogits(): string {
  const logits = Array.from({ length: 8 }, () => randomBetween(-5, 5));
  return JSON.stringify(logits);
}

// Function to fetch DHIS2 organization units and TEIs to get real site data
async function fetchDHIS2SiteData(): Promise<SiteConfig[]> {
  console.log('Fetching DHIS2 data for site configurations...');
  
  const siteConfigs: SiteConfig[] = [];
  const authHeader = `Basic ${Buffer.from(`${config.dhis2.username}:${config.dhis2.password}`).toString('base64')}`;
  
  // Use specific 5 health centers for seeding
  const targetOrgUnits = [
    { name: 'Bukatube Health Centre III', id: 'Rx8u7WLhn7R' },
    { name: 'Malongo Health Centre III', id: 'ao6V9sOp2DA' },
    { name: 'Ofua (Ofua) Health Centre III', id: 'BSrrPPLiBZo' },
    { name: 'Dzaipi Health Centre III', id: 'Krxa01FAxdW' },
    { name: 'Koboko Mission Health Centre III', id: 'aXGjPN0urzK' }
  ];
  
  try {
    console.log(`Using ${targetOrgUnits.length} target health centers for seeding`);
    console.log(`Target: 4 sites per health center = 20 total sites\n`);

    // For each health center, fetch its details and TEIs
    for (const targetOrgUnit of targetOrgUnits) {
      try {
        console.log(`Fetching data for ${targetOrgUnit.name}...`);
        
        // Fetch the organization unit details with parent hierarchy
        const orgUnitData = await httpsRequest(
          `${config.dhis2.baseUrl}/api/organisationUnits/${targetOrgUnit.id}.json?fields=id,name,displayName,parent[id,name,displayName,parent[id,name,displayName,parent[id,name,displayName]]]`,
          authHeader
        ) as any;
        
        const orgUnit = orgUnitData;
        
        // Extract hierarchy information
        const healthCenter = orgUnit.displayName || orgUnit.name;
        const parish = orgUnit.parent?.displayName || orgUnit.parent?.name || 'Unknown Parish';
        const subCounty = orgUnit.parent?.parent?.displayName || orgUnit.parent?.parent?.name || 'Unknown Sub County';
        const rawDistrict = orgUnit.parent?.parent?.parent?.displayName || orgUnit.parent?.parent?.parent?.name || 'Unknown District';
        // Trim "District" suffix (case insensitive)
        const district = rawDistrict.replace(/\s+District$/i, '').trim();
        const village = orgUnit.parent?.displayName || orgUnit.parent?.name || orgUnit.displayName || orgUnit.name;
        
        console.log(`  Health Center: ${healthCenter}`);
        console.log(`  District: ${district}, Sub County: ${subCounty}, Parish: ${parish}`);
        
        // Fetch TEIs for this org unit
        const teiData = await httpsRequest(
          `${config.dhis2.baseUrl}/api/trackedEntityInstances.json?ou=${targetOrgUnit.id}&program=${config.dhis2.programId}&fields=trackedEntityInstance,attributes[attribute,value,displayName,code]&paging=false`,
          authHeader
        ) as any;
        
        const teis = teiData.trackedEntityInstances || [];
        console.log(`  Found ${teis.length} TEIs`);
        
        // Create exactly 4 sites per health center
        const housesToCreate = 4;
        
        for (let i = 0; i < housesToCreate; i++) {
          const tei = teis[i]; // Will be undefined if not enough TEIs
          let houseNumber = `H${randomIntBetween(100, 999)}`;
          
          // Try to get house number from TEI attributes if TEI exists
          if (tei && tei.attributes) {
            const houseNumberAttr = tei.attributes.find((attr: any) => 
              (attr.code && attr.code === 'MAL 001-ER05') ||
              (attr.displayName && attr.displayName.includes('MAL 001-ER05. House Number'))
            );
            if (houseNumberAttr && houseNumberAttr.value) {
              houseNumber = houseNumberAttr.value;
            }
          }
          
          // Determine session count and conflict status
          // First 3 sites get multiple sessions (2-5), others get 1 session
          const sessionsCount = siteConfigs.length < 3 ? randomIntBetween(2, 5) : 1;
          const hasConflict = siteConfigs.length === 1 || siteConfigs.length === 2;
          
          siteConfigs.push({
            district: district,
            villageName: village,
            houseNumber: houseNumber,
            healthCenter: healthCenter,
            subCounty: subCounty,
            parish: parish,
            orgUnit: targetOrgUnit.id,
            sessionsCount: sessionsCount,
            hasConflict: hasConflict
          });
        }
        
        console.log(`  ✅ Created 4 sites from ${healthCenter} (${siteConfigs.length}/20 total)\n`);
        
      } catch (error) {
        console.log(`⚠️  Error fetching data for ${targetOrgUnit.name}:`, error);
      }
    }

    console.log(`✅ Generated ${siteConfigs.length} site configurations from DHIS2 data`);
    return siteConfigs;
    
  } catch (error) {
    console.log('⚠️  Error fetching DHIS2 data, using fallback data:', error);
    
    // Fallback: generate site configs without DHIS2 data
    const fallbackDistricts = ['Kampala', 'Wakiso', 'Mukono'];
    const fallbackVillages = ['Kyebando', 'Bwaise', 'Kazo'];
    const fallbackHealthCenters = ['Mulago HC', 'Kawempe HC', 'Kiruddu HC'];
    
    let configIndex = 0;
    for (let d = 0; d < 3; d++) {
      for (let v = 0; v < 3; v++) {
        const housesToCreate = randomIntBetween(1, 4);
        for (let h = 0; h < housesToCreate; h++) {
          const sessionsCount = configIndex < 3 ? randomIntBetween(2, 5) : 1;
          const hasConflict = configIndex === 1 || configIndex === 2;
          
          siteConfigs.push({
            district: fallbackDistricts[d],
            villageName: fallbackVillages[v],
            houseNumber: `H${randomIntBetween(100, 999)}`,
            healthCenter: fallbackHealthCenters[d],
            subCounty: `Sub County ${d + 1}`,
            parish: `Parish ${v + 1}`,
            sessionsCount: sessionsCount,
            hasConflict: hasConflict
          });
          configIndex++;
        }
      }
    }
    
    console.log(`✅ Generated ${siteConfigs.length} site configurations from fallback data`);
    return siteConfigs;
  }
}

// Function to clean up existing seeded data
async function cleanupExistingData(transaction: any) {
  console.log('Cleaning up ALL existing program data...');
  
  try {
    // Delete in reverse order of dependencies to avoid foreign key constraints
    // This will delete ALL programs and their associated data, not just the seeded program
    
    // Delete annotations first (depends on specimens) - MUST be before specimens
    await sequelize.query('DELETE FROM annotations', {
      transaction
    });
    
    // Delete annotation tasks (after annotations are deleted)
    await sequelize.query('DELETE FROM annotation_tasks', {
      transaction
    });
    
    // Delete inference results (depends on specimen images)
    await sequelize.query('DELETE FROM inference_results', {
      transaction
    });
    
    // Delete specimen images (depends on specimens)
    await sequelize.query('DELETE FROM specimen_images', {
      transaction
    });
    
    // Delete multipart uploads (depends on specimens) - MUST be before specimens
    await sequelize.query('DELETE FROM multipart_uploads', {
      transaction
    });
    
    // Delete specimens (depends on sessions)
    await sequelize.query('DELETE FROM specimens', {
      transaction
    });
    
    // Delete surveillance forms (depends on sessions)
    await sequelize.query('DELETE FROM surveillanceforms', {
      transaction
    });
    
    // Delete sessions (depends on sites and devices)
    await sequelize.query('DELETE FROM sessions', {
      transaction
    });
    
    // Delete DHIS2 sync events (depends on sites)
    await sequelize.query('DELETE FROM dhis2_sync_events', {
      transaction
    });
    
    // Delete site-user associations (must be deleted before sites)
    await sequelize.query('DELETE FROM site_users', {
      transaction
    });
    
    // Delete sites (depends on programs)
    await sequelize.query('DELETE FROM sites', {
      transaction
    });
    
    // Delete devices (depends on programs)
    await sequelize.query('DELETE FROM devices', {
      transaction
    });
    
    // Delete programs
    await sequelize.query('DELETE FROM programs', {
      transaction
    });
    
    console.log('✅ All existing program data cleaned up successfully (users preserved)');
  } catch (error) {
    console.log('ℹ️  No existing data found or cleanup not needed:', error);
  }
}

async function seedSpecimens() {
  try {
    console.log('Starting specimen seeding process...');

    // Check if database is connected
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Download and upload mosquito images to S3 first
    const uploadedImages = await uploadLocalMosquitoImages();
    console.log(`Using ${uploadedImages.length} real mosquito images for seeding`);

    // Fetch DHIS2 site data (with fallback)
    const siteConfigs = await fetchDHIS2SiteData();
    
    // Get last 3 months
    const months = getLastThreeMonths();
    console.log(`Seeding data for ${months.length} months:`, months.map(m => `${m.year}-${m.month + 1}`).join(', '));

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Clean up any existing seeded data first
      await cleanupExistingData(transaction);
      
      // Create 1 Program
      console.log('Creating program...');
      const program = await Program.create({
        name: 'National Malaria Elimination Division',
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

      // Create Sites from configurations
      console.log(`Creating ${siteConfigs.length} sites from DHIS2 data...`);
      const sites: Array<{ site: Site, config: SiteConfig }> = [];
      
      for (let i = 0; i < siteConfigs.length; i++) {
        const siteConfig = siteConfigs[i];
        const site = await Site.create({
          programId: program.id,
          district: siteConfig.district,
          subCounty: siteConfig.subCounty || null,
          parish: siteConfig.parish || null,
          villageName: siteConfig.villageName,
          houseNumber: siteConfig.houseNumber,
          isActive: true,
          healthCenter: siteConfig.healthCenter
        }, { transaction });
        sites.push({ site, config: siteConfig });
        console.log(`Created site ${i + 1}/${siteConfigs.length}: ${site.district} - ${site.villageName} - ${site.houseNumber} (Sessions: ${siteConfig.sessionsCount}, Conflict: ${siteConfig.hasConflict})`);
      }

      // Create Sessions, Specimens, and Images
      console.log('Creating sessions, surveillance forms, specimens, and images...');
      let totalSessions = 0;
      let totalSurveillanceForms = 0;
      let totalSpecimens = 0;
      let totalImages = 0;
      let totalInferenceResults = 0;
      let specimenIdCounter = 1;

      // For each month
      for (const monthData of months) {
        console.log(`\n--- Seeding month ${monthData.year}-${monthData.month + 1} ---`);
        
        // For each site
        for (const { site, config } of sites) {
          const sessionsToCreate = config.sessionsCount;
          
          // Generate base session values (for matching sessions or first session)
          const baseCollectorTitle = getRandomItem(COLLECTOR_TITLES);
          const baseCollectorName = `${getRandomItem(['John', 'Mary', 'Peter', 'Sarah', 'David'])} ${getRandomItem(['Mukasa', 'Nakato', 'Okello', 'Atim', 'Kiprotich'])}`;
          const baseCollectionMethod = getRandomItem(COLLECTION_METHODS);
          const baseSpecimenCondition = getRandomItem(SPECIMEN_CONDITIONS);
          
          for (let sessionIndex = 0; sessionIndex < sessionsToCreate; sessionIndex++) {
            const sessionCollectionDate = generateRandomDateInMonth(monthData.year, monthData.month);
            
            // Determine if this session should have different values (for conflicts)
            let collectorTitle = baseCollectorTitle;
            let collectorName = baseCollectorName;
            let collectionMethod = baseCollectionMethod;
            let specimenCondition = baseSpecimenCondition;
            
            if (config.hasConflict && sessionIndex > 0) {
              // Create conflicting values for subsequent sessions
              collectorTitle = getRandomItem(COLLECTOR_TITLES);
              collectorName = `${getRandomItem(['Jane', 'Moses', 'Grace', 'Samuel', 'Ruth'])} ${getRandomItem(['Nambi', 'Ssemakula', 'Nalwoga', 'Byaruhanga', 'Akello'])}`;
              collectionMethod = getRandomItem(COLLECTION_METHODS);
              specimenCondition = getRandomItem(SPECIMEN_CONDITIONS);
            }
            
            const session = await Session.create({
              frontendId: `session_${site.id}_${monthData.year}${monthData.month}_${sessionIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              collectorTitle: collectorTitle,
              collectorName: collectorName,
              collectionDate: sessionCollectionDate,
              collectionMethod: collectionMethod,
              specimenCondition: specimenCondition,
              submittedAt: sessionCollectionDate,
              notes: `Collection at ${site.villageName}, House ${site.houseNumber}`,
              siteId: site.id,
              deviceId: device.id,
              latitude: randomBetween(-1.5, 4.5), // Uganda latitude range
              longitude: randomBetween(29.5, 35.0), // Uganda longitude range
              type: 'SURVEILLANCE', // All seeded sessions are surveillance type
              createdAt: sessionCollectionDate,
              updatedAt: sessionCollectionDate
            }, { transaction });

            totalSessions++;

            // Create surveillance form for this session
            const surveillanceFormData = generateSurveillanceFormData();
            await SurveillanceForm.create({
              sessionId: session.id,
              numPeopleSleptInHouse: surveillanceFormData.numPeopleSleptInHouse,
              wasIrsConducted: surveillanceFormData.wasIrsConducted,
              monthsSinceIrs: surveillanceFormData.monthsSinceIrs,
              numLlinsAvailable: surveillanceFormData.numLlinsAvailable,
              llinType: surveillanceFormData.llinType,
              llinBrand: surveillanceFormData.llinBrand,
              numPeopleSleptUnderLlin: surveillanceFormData.numPeopleSleptUnderLlin,
              createdAt: sessionCollectionDate,
              updatedAt: sessionCollectionDate
            }, { transaction });
            
            totalSurveillanceForms++;

            // Determine number of specimens for this session (5-15, or 0 for a couple of sessions)
            const shouldHaveZeroSpecimens = totalSessions % 15 === 0; // Every 15th session has 0 specimens
            const specimenCount = shouldHaveZeroSpecimens ? 0 : randomIntBetween(5, 15);

            // Create Specimens
            for (let specimenIndex = 0; specimenIndex < specimenCount; specimenIndex++) {
              const specimenTimestamp = new Date(sessionCollectionDate.getTime() + Math.random() * 6 * 60 * 60 * 1000);
              const specimenId = generateSpecimenId(specimenIdCounter++);

              const specimen = await Specimen.create({
                specimenId: specimenId,
                sessionId: session.id,
                createdAt: specimenTimestamp,
                updatedAt: specimenTimestamp
              }, { transaction });

              totalSpecimens++;

              // Get real image data from uploaded images (rotate through the 10 images)
              const imageData = getImageDataFromUploaded(uploadedImages, specimenIdCounter);
              
              // Get valid species and attributes
              const species = getRandomItem(SPECIES_OPTIONS);
              const { sex, abdomenStatus } = getValidSpecimenAttributes(species);
              
              // Create SpecimenImage (thumbnail)
              const specimenImage = await SpecimenImage.create({
                specimenId: specimen.id,
                imageKey: imageData.imageKey,
                filemd5: imageData.md5,
                species: species,
                sex: sex,
                abdomenStatus: abdomenStatus,
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

            console.log(`  Created session for site ${site.houseNumber} (${site.villageName}): ${specimenCount} specimens`);
          }
        }
      }

      // Commit transaction
      await transaction.commit();

      console.log('\n=== Seeding Summary ===');
      console.log(`✅ Programs created: 1`);
      console.log(`✅ Devices created: 1`);
      console.log(`✅ Sites created: ${sites.length}`);
      console.log(`✅ Sessions created: ${totalSessions} (across 3 months)`);
      console.log(`✅ Surveillance forms created: ${totalSurveillanceForms} (one per session)`);
      console.log(`✅ Specimens created: ${totalSpecimens}`);
      console.log(`✅ Specimen images created: ${totalImages}`);
      console.log(`✅ Inference results created: ${totalInferenceResults}`);
      console.log(`✅ Sites with multiple sessions: 3`);
      console.log(`✅ Sites with conflicting sessions: 2`);
      console.log(`✅ Seeding completed successfully!`);

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
