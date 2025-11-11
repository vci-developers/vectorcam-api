/**
 * Seeding Script from CSV Data for VectorCam API
 * 
 * This script seeds the database with data from CSV files for May, June, July, and August 2024.
 * The specimen counts, species, sex, and abdomen status EXACTLY match the CSV reports.
 * 
 * Features:
 * - Reads 4 CSV files from static/data (May, June, July, August 2024)
 * - Parses CSV data to extract sites, house numbers, and mosquito counts
 * - Creates sessions based on house numbers (at least 1 per month, occasionally 2-3)
 * - Uses specimen IDs with district codes: UAD (Adjumani), UMA (Mayuge), etc.
 * - Uses random images from static/assets for specimens
 * - Uploads images to S3
 * - Creates specimens matching EXACT counts from CSV:
 *   * Species: Anopheles gambiae, Anopheles funestus, Anopheles other, Culex, Aedes, Mansonia
 *   * Sex: Male (no abdomen status) or Female (with abdomen status)
 *   * Abdomen Status: Unfed (UF), Full fed (F), Gravid (G)
 * - Maps CSV columns to specimen attributes:
 *   * anGambiaeUF → Anopheles gambiae, Female, Unfed
 *   * AnGambiaeMale → Anopheles gambiae, Male, null
 *   * culexFemale → Culex, Female, (varies)
 *   * etc.
 * - Maps CSV collection methods and other metadata to sessions
 * - DOES NOT delete existing data - reuses existing programs, devices, and sites
 * - Avoids duplicate specimen IDs by continuing from highest existing ID
 * 
 * Run with: npx ts-node scripts/seed-from-csv.ts
 */

import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parse } from 'csv-parse/sync';

// Import database and models
import sequelize from '../src/db/index';
import { Program, Site, Device, Session, Specimen, SpecimenImage, InferenceResult, SurveillanceForm } from '../src/db/models';
import { uploadFile } from '../src/services/s3.service';

// District code mappings for specimen IDs
const DISTRICT_CODES: { [key: string]: string } = {
  'Adjumani': 'UAD',
  'Mayuge': 'UMA',
  'Arua': 'UAR',
  'Kampala': 'UKA',
  'Wakiso': 'UWA'
};

interface CSVRow {
  country: string;
  district: string;
  site: string;
  houseNumber: string;
  collectionMethod: string;
  total: number;
  totalAnopheles: number;
  totalOtherMosquitoes: number;
  maleAnopheles: number;
  anGambiaeUF: number;
  anGambiaeF: number;
  anGambiaeG: number;
  anFunestusUF: number;
  anFunestusF: number;
  anFunestusG: number;
  anOtherUF: number;
  anOtherF: number;
  anOtherG: number;
  CulexUF: number;
  CulexF: number;
  CulexG: number;
  AedesUF: number;
  AedesF: number;
  AedesG: number;
  MansoniaUF: number;
  MansoniaF: number;
  MansoniaG: number;
  AnFunestusMale: number;
  AnFunestusFemale: number;
  AnGambiaeMale: number;
  AnGambiaeFemale: number;
  AnOtherMale: number;
  AnOtherFemale: number;
  culexMale: number;
  culexFemale: number;
  aedesMale: number;
  aedesFemale: number;
  mansoniaMale: number;
  mansoniaFemale: number;
  peopleSlept: number;
  irsSprayed: string;
  monthsAgo: number;
  totalLLIN: number;
  llinType: string;
  llinBrand: string;
  peopleSleptUnderLlin: number;
  name: string;
  date: string;
  'site code': string;
  'health centre': string;
  parish: string;
  village: string;
  'coded house number': string;
  Latitude: number;
  Longitude: number;
  'House Type': string;
  'Title of Officer': string;
}

interface SiteData {
  district: string;
  site: string;
  houseNumber: string;
  healthCenter: string;
  parish: string;
  village: string;
  codedHouseNumber: string;
  latitude: number;
  longitude: number;
  monthlySessions: Map<string, CSVRow[]>; // monthKey -> array of CSV rows for that month
}

interface UploadedImage {
  imageKey: string;
  md5: string;
  buffer: Buffer;
}

// Helper function to parse date from CSV (format: dd/mm/yyyy)
function parseDate(dateStr: string): Date {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date();
}

// Helper function to get month key
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

// Helper function to parse CSV file
function parseCSVFile(filePath: string): CSVRow[] {
  console.log(`Reading CSV file: ${filePath}`);
  const fileContent = readFileSync(filePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      if (context.column === 'irsSprayed') {
        return value === 'TRUE' || value === 'true';
      }
      // Try to parse as number for numeric fields
      if (context.column && typeof context.column === 'string') {
        const numericFields = ['total', 'totalAnopheles', 'totalOtherMosquitoes', 'maleAnopheles',
          'anGambiaeUF', 'anGambiaeF', 'anGambiaeG', 'anFunestusUF', 'anFunestusF', 'anFunestusG',
          'anOtherUF', 'anOtherF', 'anOtherG', 'CulexUF', 'CulexF', 'CulexG',
          'AedesUF', 'AedesF', 'AedesG', 'MansoniaUF', 'MansoniaF', 'MansoniaG',
          'AnFunestusMale', 'AnFunestusFemale', 'AnGambiaeMale', 'AnGambiaeFemale',
          'AnOtherMale', 'AnOtherFemale', 'culexMale', 'culexFemale', 'aedesMale', 'aedesFemale',
          'mansoniaMale', 'mansoniaFemale', 'peopleSlept', 'monthsAgo', 'totalLLIN',
          'peopleSleptUnderLlin', 'Latitude', 'Longitude'];
        
        if (numericFields.includes(context.column)) {
          const num = parseFloat(value);
          return isNaN(num) ? 0 : num;
        }
      }
      return value;
    }
  });
  
  return records;
}

// Helper function to organize CSV data by site and month
function organizeSiteData(csvRows: CSVRow[]): Map<string, SiteData> {
  const siteMap = new Map<string, SiteData>();
  
  for (const row of csvRows) {
    // Create unique site key
    const siteKey = `${row.district}_${row.site}_${row.houseNumber}`;
    
    let siteData = siteMap.get(siteKey);
    if (!siteData) {
      siteData = {
        district: row.district,
        site: row.site,
        houseNumber: row.houseNumber,
        healthCenter: row['health centre'],
        parish: row.parish,
        village: row.village,
        codedHouseNumber: row['coded house number'],
        latitude: row.Latitude,
        longitude: row.Longitude,
        monthlySessions: new Map()
      };
      siteMap.set(siteKey, siteData);
    }
    
    // Add this row to the appropriate month
    const date = parseDate(row.date);
    const monthKey = getMonthKey(date);
    
    if (!siteData.monthlySessions.has(monthKey)) {
      siteData.monthlySessions.set(monthKey, []);
    }
    siteData.monthlySessions.get(monthKey)!.push(row);
  }
  
  return siteMap;
}

// Helper function to upload local mosquito images to S3
async function uploadLocalMosquitoImages(): Promise<UploadedImage[]> {
  console.log('Reading local mosquito images from /static/assets and uploading to S3...');
  const uploadedImages: UploadedImage[] = [];
  const assetsDir = path.join(__dirname, '..', 'static', 'assets');

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
      
      const imageBuffer = readFileSync(filePath);
      const md5 = crypto.createHash('md5').update(imageBuffer).digest('hex');
      
      const timestamp = Date.now();
      const ext = path.extname(filename);
      const imageKey = `specimens/seed_csv_${i + 1}_${timestamp}${ext}`;
      
      const contentType = ext === '.png' ? 'image/png' : 
                         ext === '.gif' ? 'image/gif' :
                         ext === '.webp' ? 'image/webp' : 'image/jpeg';
      
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
    }
  }

  if (uploadedImages.length === 0) {
    throw new Error('Failed to read and upload any mosquito images');
  }

  console.log(`✅ Successfully uploaded ${uploadedImages.length} local mosquito images to S3`);
  return uploadedImages;
}

// Helper function to generate specimen ID with district code
function generateSpecimenId(districtCode: string, index: number): string {
  const numbers = String(index % 1000).padStart(3, '0');
  return `${districtCode}${numbers}`;
}

// Helper function to get random item from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random number within range
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Helper function to generate random integer within range
function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate inference result logits
function generateLogits(): string {
  const logits = Array.from({ length: 8 }, () => randomBetween(-5, 5));
  return JSON.stringify(logits);
}

// Specimen attribute interface
interface SpecimenAttributes {
  species: string;
  sex: string | null;
  abdomenStatus: string | null;
}

// Helper function to parse CSV row and extract all specimen attributes
function parseSpecimensFromCSVRow(csvRow: CSVRow): SpecimenAttributes[] {
  const specimens: SpecimenAttributes[] = [];
  
  // Anopheles gambiae - Unfed females
  for (let i = 0; i < csvRow.anGambiaeUF; i++) {
    specimens.push({ species: 'Anopheles gambiae', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Anopheles gambiae - Full fed females
  for (let i = 0; i < csvRow.anGambiaeF; i++) {
    specimens.push({ species: 'Anopheles gambiae', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Anopheles gambiae - Gravid females
  for (let i = 0; i < csvRow.anGambiaeG; i++) {
    specimens.push({ species: 'Anopheles gambiae', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Anopheles gambiae - Males
  for (let i = 0; i < csvRow.AnGambiaeMale; i++) {
    specimens.push({ species: 'Anopheles gambiae', sex: 'Male', abdomenStatus: null });
  }
  
  // Anopheles funestus - Unfed females
  for (let i = 0; i < csvRow.anFunestusUF; i++) {
    specimens.push({ species: 'Anopheles funestus', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Anopheles funestus - Full fed females
  for (let i = 0; i < csvRow.anFunestusF; i++) {
    specimens.push({ species: 'Anopheles funestus', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Anopheles funestus - Gravid females
  for (let i = 0; i < csvRow.anFunestusG; i++) {
    specimens.push({ species: 'Anopheles funestus', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Anopheles funestus - Males
  for (let i = 0; i < csvRow.AnFunestusMale; i++) {
    specimens.push({ species: 'Anopheles funestus', sex: 'Male', abdomenStatus: null });
  }
  
  // Anopheles other - Unfed females
  for (let i = 0; i < csvRow.anOtherUF; i++) {
    specimens.push({ species: 'Anopheles other', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Anopheles other - Full fed females
  for (let i = 0; i < csvRow.anOtherF; i++) {
    specimens.push({ species: 'Anopheles other', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Anopheles other - Gravid females
  for (let i = 0; i < csvRow.anOtherG; i++) {
    specimens.push({ species: 'Anopheles other', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Anopheles other - Males
  for (let i = 0; i < csvRow.AnOtherMale; i++) {
    specimens.push({ species: 'Anopheles other', sex: 'Male', abdomenStatus: null });
  }
  
  // Culex - Unfed females
  for (let i = 0; i < csvRow.CulexUF; i++) {
    specimens.push({ species: 'Culex', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Culex - Full fed females
  for (let i = 0; i < csvRow.CulexF; i++) {
    specimens.push({ species: 'Culex', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Culex - Gravid females
  for (let i = 0; i < csvRow.CulexG; i++) {
    specimens.push({ species: 'Culex', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Culex - Males
  for (let i = 0; i < csvRow.culexMale; i++) {
    specimens.push({ species: 'Culex', sex: 'Male', abdomenStatus: null });
  }
  
  // Aedes - Unfed females
  for (let i = 0; i < csvRow.AedesUF; i++) {
    specimens.push({ species: 'Aedes', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Aedes - Full fed females
  for (let i = 0; i < csvRow.AedesF; i++) {
    specimens.push({ species: 'Aedes', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Aedes - Gravid females
  for (let i = 0; i < csvRow.AedesG; i++) {
    specimens.push({ species: 'Aedes', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Aedes - Males
  for (let i = 0; i < csvRow.aedesMale; i++) {
    specimens.push({ species: 'Aedes', sex: 'Male', abdomenStatus: null });
  }
  
  // Mansonia - Unfed females
  for (let i = 0; i < csvRow.MansoniaUF; i++) {
    specimens.push({ species: 'Mansonia', sex: 'Female', abdomenStatus: 'Unfed' });
  }
  
  // Mansonia - Full fed females
  for (let i = 0; i < csvRow.MansoniaF; i++) {
    specimens.push({ species: 'Mansonia', sex: 'Female', abdomenStatus: 'Full fed' });
  }
  
  // Mansonia - Gravid females
  for (let i = 0; i < csvRow.MansoniaG; i++) {
    specimens.push({ species: 'Mansonia', sex: 'Female', abdomenStatus: 'Gravid' });
  }
  
  // Mansonia - Males
  for (let i = 0; i < csvRow.mansoniaMale; i++) {
    specimens.push({ species: 'Mansonia', sex: 'Male', abdomenStatus: null });
  }
  
  return specimens;
}

// NOTE: This script does NOT delete existing data
// It will reuse existing programs, devices, and sites
// and add new sessions/specimens without conflicts

async function seedFromCSV() {
  try {
    console.log('Starting CSV-based seeding process...');

    // Check database connection
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Upload mosquito images to S3
    const uploadedImages = await uploadLocalMosquitoImages();
    console.log(`Using ${uploadedImages.length} mosquito images for seeding`);

    // Read and parse CSV files
    const dataDir = path.join(__dirname, '..', 'static', 'data');
    const csvFiles = [
      'Copy of VectorCam May 2024 Report V1 - VectorCam May 2024 Data.csv',
      'Copy of VectorCam June 2024 Report - VectorCam June 2024 Data.csv',
      'Copy of VectorCam July 2024 Report - VectorCam July 2024 Data.csv',
      'Copy of VectorCam August 2024 Report - VectorCam August 2024 Data.csv'
    ];

    // Parse all CSV files
    const allCSVRows: CSVRow[] = [];
    for (const csvFile of csvFiles) {
      const csvPath = path.join(dataDir, csvFile);
      const rows = parseCSVFile(csvPath);
      allCSVRows.push(...rows);
      console.log(`  Loaded ${rows.length} rows from ${csvFile}`);
    }

    console.log(`Total CSV rows loaded: ${allCSVRows.length}`);

    // Organize data by site and month
    const siteDataMap = organizeSiteData(allCSVRows);
    console.log(`Organized data into ${siteDataMap.size} unique sites`);

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Find or create Program (DO NOT delete existing data)
      console.log('Finding or creating program...');
      let program = await Program.findOne({
        where: { name: 'National Malaria Elimination Division', country: 'Uganda' },
        transaction
      });
      
      if (!program) {
        program = await Program.create({
          name: 'National Malaria Elimination Division',
          country: 'Uganda'
        }, { transaction });
        console.log(`Created new program: ${program.name} (ID: ${program.id})`);
      } else {
        console.log(`Using existing program: ${program.name} (ID: ${program.id})`);
      }

      // Find or create Device (DO NOT delete existing data)
      console.log('Finding or creating device...');
      let device = await Device.findOne({
        where: { model: 'VectorCam Mobile', programId: program.id },
        transaction
      });
      
      if (!device) {
        device = await Device.create({
          model: 'VectorCam Mobile',
          registeredAt: new Date(),
          programId: program.id
        }, { transaction });
        console.log(`Created new device: ${device.model} (ID: ${device.id})`);
      } else {
        console.log(`Using existing device: ${device.model} (ID: ${device.id})`);
      }

      // Find or create Sites (DO NOT delete existing data)
      console.log(`Finding or creating ${siteDataMap.size} sites...`);
      const siteMapping = new Map<string, { site: Site, siteData: SiteData }>();
      let sitesCreated = 0;
      let sitesReused = 0;
      
      for (const [siteKey, siteData] of siteDataMap) {
        // Try to find existing site
        let site = await Site.findOne({
          where: {
            programId: program.id,
            district: siteData.district,
            houseNumber: siteData.codedHouseNumber
          },
          transaction
        });
        
        if (!site) {
          // Create new site if it doesn't exist
          site = await Site.create({
            programId: program.id,
            district: siteData.district,
            subCounty: siteData.site,
            parish: siteData.parish,
            villageName: siteData.village,
            houseNumber: siteData.codedHouseNumber,
            isActive: true,
            healthCenter: siteData.healthCenter
          }, { transaction });
          sitesCreated++;
          console.log(`  Created site: ${site.district} - ${site.villageName} - ${site.houseNumber}`);
        } else {
          sitesReused++;
          console.log(`  Using existing site: ${site.district} - ${site.villageName} - ${site.houseNumber}`);
        }
        
        siteMapping.set(siteKey, { site, siteData });
      }
      
      console.log(`Sites summary: ${sitesCreated} created, ${sitesReused} reused`);

      // Find the highest existing specimen ID number to avoid duplicates
      console.log('Checking for existing specimens to avoid ID conflicts...');
      let specimenIdCounter = 1;
      try {
        const existingSpecimens = await Specimen.findAll({
          attributes: ['specimenId'],
          transaction
        });
        
        if (existingSpecimens.length > 0) {
          // Extract numeric parts from specimen IDs and find the max
          const maxNumber = existingSpecimens.reduce((max, specimen) => {
            const match = specimen.specimenId.match(/\d+$/);
            if (match) {
              const num = parseInt(match[0], 10);
              return num > max ? num : max;
            }
            return max;
          }, 0);
          specimenIdCounter = maxNumber + 1;
          console.log(`Found ${existingSpecimens.length} existing specimens, starting new IDs from ${specimenIdCounter}`);
        } else {
          console.log('No existing specimens found, starting from 1');
        }
      } catch (error) {
        console.log('Could not check existing specimens, starting from 1:', error);
      }
      
      // Create Sessions and Specimens
      console.log('Creating sessions and specimens...');
      let totalSessions = 0;
      let totalSpecimens = 0;
      let totalImages = 0;
      let totalInferenceResults = 0;

      for (const [siteKey, { site, siteData }] of siteMapping) {
        const districtCode = DISTRICT_CODES[siteData.district] || 'UXX';
        
        // For each month that has data for this site
        for (const [monthKey, csvRows] of siteData.monthlySessions) {
          console.log(`\n  Processing ${siteData.district} - ${siteData.houseNumber} - ${monthKey}`);
          
          // Parse all specimens from all CSV rows for this month
          const allSpecimenAttributes: SpecimenAttributes[] = [];
          for (const csvRow of csvRows) {
            const specimens = parseSpecimensFromCSVRow(csvRow);
            allSpecimenAttributes.push(...specimens);
          }
          
          const totalMosquitoes = allSpecimenAttributes.length;
          console.log(`    Total specimens from CSV: ${totalMosquitoes}`);
          
          // Determine how many sessions to create for this month
          // At least 1, occasionally 2-3 based on number of CSV rows
          let sessionsToCreate = 1;
          if (csvRows.length >= 3) {
            // If we have 3+ rows, create 2-3 sessions
            sessionsToCreate = randomIntBetween(2, 3);
          } else if (csvRows.length >= 2) {
            // If we have 2 rows, create 1-2 sessions
            sessionsToCreate = Math.random() < 0.7 ? 1 : 2;
          }
          
          // Distribute specimen attributes across sessions
          const specimensPerSession: SpecimenAttributes[][] = [];
          for (let i = 0; i < sessionsToCreate; i++) {
            specimensPerSession.push([]);
          }
          
          // Shuffle and distribute specimens to ensure variety across sessions
          const shuffledSpecimens = [...allSpecimenAttributes].sort(() => Math.random() - 0.5);
          shuffledSpecimens.forEach((specimen, index) => {
            specimensPerSession[index % sessionsToCreate].push(specimen);
          });
          
          // Create sessions
          for (let sessionIndex = 0; sessionIndex < sessionsToCreate; sessionIndex++) {
            // Pick a representative CSV row for this session
            const csvRow = csvRows[sessionIndex % csvRows.length];
            const sessionDate = parseDate(csvRow.date);
            
            // Add some time variation if multiple sessions in same month
            if (sessionIndex > 0) {
              sessionDate.setDate(sessionDate.getDate() + randomIntBetween(1, 7));
            }
            
            const session = await Session.create({
              frontendId: `csv_session_${site.id}_${monthKey}_${sessionIndex}_${Date.now()}`,
              collectorTitle: csvRow['Title of Officer'] || 'Village Health Team Member',
              collectorName: csvRow.name || 'Unknown',
              collectionDate: sessionDate,
              collectionMethod: csvRow.collectionMethod,
              specimenCondition: 'Fresh',
              submittedAt: sessionDate,
              notes: `Collection at ${siteData.village}, House ${siteData.codedHouseNumber}`,
              siteId: site.id,
              deviceId: device.id,
              latitude: siteData.latitude,
              longitude: siteData.longitude,
              type: 'SURVEILLANCE',
              createdAt: sessionDate,
              updatedAt: sessionDate
            }, { transaction });

            totalSessions++;

            // Create surveillance form
            await SurveillanceForm.create({
              sessionId: session.id,
              numPeopleSleptInHouse: csvRow.peopleSlept || null,
              wasIrsConducted: csvRow.irsSprayed,
              monthsSinceIrs: csvRow.monthsAgo || null,
              numLlinsAvailable: csvRow.totalLLIN || null,
              llinType: csvRow.llinType || null,
              llinBrand: csvRow.llinBrand || null,
              numPeopleSleptUnderLlin: csvRow.peopleSleptUnderLlin || null,
              createdAt: sessionDate,
              updatedAt: sessionDate
            }, { transaction });

            // Create specimens for this session using parsed CSV attributes
            const sessionSpecimens = specimensPerSession[sessionIndex];
            
            for (const specimenAttrs of sessionSpecimens) {
              const specimenTimestamp = new Date(sessionDate.getTime() + Math.random() * 6 * 60 * 60 * 1000);
              const specimenId = generateSpecimenId(districtCode, specimenIdCounter++);

              const specimen = await Specimen.create({
                specimenId: specimenId,
                sessionId: session.id,
                createdAt: specimenTimestamp,
                updatedAt: specimenTimestamp
              }, { transaction });

              totalSpecimens++;

              // Get random image
              const imageData = uploadedImages[specimenIdCounter % uploadedImages.length];
              
              // Create SpecimenImage with CSV-derived attributes
              const specimenImage = await SpecimenImage.create({
                specimenId: specimen.id,
                imageKey: imageData.imageKey,
                filemd5: imageData.md5,
                species: specimenAttrs.species,
                sex: specimenAttrs.sex,
                abdomenStatus: specimenAttrs.abdomenStatus,
                capturedAt: specimenTimestamp,
                createdAt: specimenTimestamp,
                updatedAt: specimenTimestamp
              }, { transaction });

              totalImages++;

              // Update specimen with thumbnail
              await specimen.update({
                thumbnailImageId: specimenImage.id
              }, { transaction });

              // Create InferenceResult
              await InferenceResult.create({
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

            console.log(`    Created session ${sessionIndex + 1}/${sessionsToCreate}: ${sessionSpecimens.length} specimens`);
          }
        }
      }

      // Commit transaction
      await transaction.commit();

      console.log('\n=== Seeding Summary ===');
      console.log(`✅ Programs created: 1`);
      console.log(`✅ Devices created: 1`);
      console.log(`✅ Sites created: ${siteMapping.size}`);
      console.log(`✅ Sessions created: ${totalSessions}`);
      console.log(`✅ Specimens created: ${totalSpecimens}`);
      console.log(`✅ Specimen images created: ${totalImages}`);
      console.log(`✅ Inference results created: ${totalInferenceResults}`);
      console.log(`✅ Seeding completed successfully!`);

    } catch (error) {
      await transaction.rollback();
      console.error('Error during seeding, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error in seeding process:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

// Run the seeding function
if (require.main === module) {
  seedFromCSV()
    .then(() => {
      console.log('Seeding script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding script failed:', error);
      process.exit(1);
    });
}

export default seedFromCSV;

