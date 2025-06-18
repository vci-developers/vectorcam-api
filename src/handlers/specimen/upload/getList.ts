import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload, Specimen } from '../../../db/models';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Specimens'],
  params: {
    type: 'object',
    required: ['specimen_id'],
    properties: {
      specimen_id: { type: 'string', description: 'Specimen ID or specimen identifier' }
    }
  },
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'Filter by upload status' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'createdAt', 'updatedAt', 'status'], default: 'createdAt', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        uploads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              specimenId: { type: 'number' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'] },
              currentPart: { type: 'number' },
              totalParts: { type: 'number', nullable: true },
              bufferSize: { type: 'number' },
              s3UploadId: { type: 'string', nullable: true },
              s3Key: { type: 'string', nullable: true },
              filemd5: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' }
            }
          }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

interface QueryParams {
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export async function getUploadList(
  request: FastifyRequest<{ 
    Params: { specimen_id: string };
    Querystring: QueryParams;
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id } = request.params;
    const {
      status,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = request.query;

    // First, find the specimen to get its ID
    let specimen: Specimen | null;
    
    // Check if specimen_id is a valid number
    if (!isNaN(Number(specimen_id))) {
      specimen = await Specimen.findByPk(Number(specimen_id));
    } else {
      specimen = await Specimen.findOne({
        where: { specimenId: specimen_id }
      });
    }

    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Build where clause
    const whereClause: any = {
      specimenId: specimen.id
    };

    if (status) {
      whereClause.status = status;
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await MultipartUpload.count({ where: whereClause });

    // Get uploads with pagination
    const uploads = await MultipartUpload.findAll({
      where: whereClause,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedUploads = uploads.map((upload: MultipartUpload) => ({
      id: upload.id,
      specimenId: upload.specimenId,
      status: upload.status,
      currentPart: upload.currentPart,
      totalParts: upload.totalParts,
      bufferSize: upload.bufferSize,
      s3UploadId: upload.s3UploadId,
      s3Key: upload.s3Key,
      filemd5: upload.filemd5,
      createdAt: upload.createdAt.getTime(),
      updatedAt: upload.updatedAt.getTime()
    }));

    return reply.code(200).send({
      uploads: formattedUploads,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 