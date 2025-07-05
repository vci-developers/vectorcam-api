import { SpecimenImage } from '../src/db/models';
import sequelize from '../src/db/index';
import { getFileStream } from '../src/services/s3.service';
import { createHash } from 'crypto';

async function addFilemd5Column() {
  try {
    console.log('Adding filemd5 column to specimen_images table...');
    
    // Add the filemd5 column to the specimen_images table
    await sequelize.getQueryInterface().addColumn('specimen_images', 'filemd5', {
      type: 'VARCHAR(32)',
      allowNull: false,
      defaultValue: '' // Temporary default for existing records
    });
    
    console.log('Successfully added filemd5 column to specimen_images table');
    
    // Get all existing specimen images
    const images = await SpecimenImage.findAll();
    console.log(`Found ${images.length} existing images to update with MD5 hashes...`);
    
    // Calculate MD5 for each image by fetching from S3
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        console.log(`Processing image ${i + 1}/${images.length}: ID ${image.id}, Key: ${image.imageKey}`);
        
        // Fetch the file from S3
        const { stream } = await getFileStream(image.imageKey);
        
        // Read the stream and calculate MD5
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        const filemd5 = createHash('md5').update(fileBuffer).digest('hex');
        
        // Update the record with the calculated MD5
        await image.update({ filemd5 });
        
        console.log(`✓ Updated image ${image.id} with MD5: ${filemd5}`);
      } catch (error) {
        console.error(`✗ Error processing image ${image.id}:`, error);
        // Set a placeholder MD5 for failed downloads
        await image.update({ filemd5: '00000000000000000000000000000000' });
        console.log(`  Set placeholder MD5 for image ${image.id}`);
      }
    }
    
    console.log('Successfully updated all existing images with MD5 hashes');
    
  } catch (error) {
    console.error('Error adding filemd5 column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
addFilemd5Column()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 