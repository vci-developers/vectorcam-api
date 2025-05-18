import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { config } from '../config/environment';
import pino from 'pino';
import { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

const logger = pino();

// Initialize S3 client
export const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId || '',
    secretAccessKey: config.aws.secretAccessKey || '',
  },
});

export const uploadFile = async (
  key: string, 
  body: Buffer, 
  contentType: string
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    logger.info(`File uploaded successfully: ${key}`);
    return key;
  } catch (error) {
    logger.error('Error uploading file to S3:', error);
    throw error;
  }
};

export const getFile = async (key: string): Promise<Buffer> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    const bodyContents = await response.Body?.transformToByteArray();
    
    if (!bodyContents) {
      throw new Error('Failed to get file contents');
    }
    
    return Buffer.from(bodyContents);
  } catch (error) {
    logger.error('Error getting file from S3:', error);
    throw error;
  }
};

export const deleteFile = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
    });

    await s3Client.send(command);
    logger.info(`File deleted successfully: ${key}`);
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw error;
  }
};

export const getFileStream = async (key: string): Promise<{ stream: Readable; contentType: string }> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Failed to get file stream');
    }
    
    // Use the proper way to convert to a Node.js readable stream
    const stream = response.Body as Readable;
    
    // Get the content type from the response
    const contentType = response.ContentType || 'application/octet-stream';
    
    return { stream, contentType };
  } catch (error) {
    logger.error('Error getting file stream from S3:', error);
    throw error;
  }
};

export const uploadFileStream = async (
  key: string, 
  stream: Readable, 
  contentType: string
): Promise<string> => {
  try {
    // Use the AWS SDK Upload class for multipart uploads
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: config.aws.s3BucketName,
        Key: key,
        Body: stream,
        ContentType: contentType,
      },
    });

    await upload.done();
    logger.info(`File streamed and uploaded successfully: ${key}`);
    return key;
  } catch (error) {
    logger.error('Error streaming file to S3:', error);
    throw error;
  }
};

export const initiateMultipartUpload = async (
  key: string,
  contentType: string = 'application/octet-stream'
): Promise<{ uploadId: string; key: string }> => {
  try {
    const command = new CreateMultipartUploadCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
      ContentType: contentType,
    });

    const { UploadId } = await s3Client.send(command);
    if (!UploadId) {
      throw new Error('Failed to get upload ID from S3');
    }

    logger.info(`Multipart upload initiated: ${key}`);
    return { uploadId: UploadId, key };
  } catch (error) {
    logger.error('Error initiating multipart upload:', error);
    throw error;
  }
};

export const uploadPart = async (
  key: string,
  uploadId: string,
  partNumber: number,
  body: Readable,
  contentLength?: number
): Promise<string> => {
  try {
    const command = new UploadPartCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
      ContentLength: contentLength
    });

    const { ETag } = await s3Client.send(command);
    if (!ETag) {
      throw new Error('Failed to get ETag from S3');
    }

    logger.info(`Part ${partNumber} uploaded successfully for ${key}`);
    return ETag;
  } catch (error) {
    logger.error(`Error uploading part ${partNumber}:`, error);
    throw error;
  }
};

export const completeMultipartUpload = async (
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> => {
  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.aws.s3BucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    await s3Client.send(command);
    logger.info(`Multipart upload completed: ${key}`);
  } catch (error) {
    logger.error('Error completing multipart upload:', error);
    throw error;
  }
};
