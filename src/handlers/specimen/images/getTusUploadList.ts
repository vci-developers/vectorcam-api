import { FastifyReply, FastifyRequest } from 'fastify';
import { Op, Order } from 'sequelize';
import { Specimen, TusUploadLog } from '../../../db/models';
import { TusUploadPartRecord } from '../../../db/models/TusUploadLog';

export const schema = {
  tags: ['Specimens'],
  params: {
    type: 'object',
    required: ['specimen_id'],
    properties: {
      specimen_id: { type: 'number', description: 'Specimen ID' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['created', 'in_progress', 'completed', 'failed'] },
      imageId: { type: 'number' },
      tusUploadId: { type: 'string' },
      startedFrom: { type: 'number', description: 'Upload started at or after (unix ms)' },
      startedTo: { type: 'number', description: 'Upload started at or before (unix ms)' },
      finishedFrom: { type: 'number', description: 'Upload finished at or after (unix ms)' },
      finishedTo: { type: 'number', description: 'Upload finished at or before (unix ms)' },
      includeParts: { type: 'boolean', default: true },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      offset: { type: 'number', minimum: 0, default: 0 },
      sortBy: { type: 'string', enum: ['id', 'createdAt', 'updatedAt', 'uploadCreatedAt', 'uploadStartedAt', 'uploadFinishedAt'], default: 'createdAt' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
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
              tusUploadId: { type: 'string' },
              status: { type: 'string', enum: ['created', 'in_progress', 'completed', 'failed'] },
              requestedImageRef: { type: 'string', nullable: true },
              imageId: { type: 'number', nullable: true },
              uploadLength: { type: 'number', nullable: true },
              uploadCreatedAt: { type: 'number', nullable: true },
              uploadStartedAt: { type: 'number', nullable: true },
              uploadFinishedAt: { type: 'number', nullable: true },
              failureReason: { type: 'string', nullable: true },
              s3Path: { type: 'string', nullable: true },
              metadata: { type: 'object', nullable: true, additionalProperties: true },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              partCount: { type: 'number' },
              uploadedBytes: { type: 'number' },
              parts: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    partNumber: { type: 'number' },
                    partSize: { type: 'number', nullable: true },
                    uploadOffset: { type: 'number', nullable: true },
                    uploadedAt: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

interface QueryParams {
  status?: 'created' | 'in_progress' | 'completed' | 'failed';
  imageId?: number;
  tusUploadId?: string;
  startedFrom?: number;
  startedTo?: number;
  finishedFrom?: number;
  finishedTo?: number;
  includeParts?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'createdAt' | 'updatedAt' | 'uploadCreatedAt' | 'uploadStartedAt' | 'uploadFinishedAt';
  sortOrder?: 'asc' | 'desc';
}

const toNullableTimestamp = (value: Date | null): number | null => {
  return value ? value.getTime() : null;
};

const toNullableNumber = (value: number | string | null): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function getTusUploadList(
  request: FastifyRequest<{
    Params: { specimen_id: number };
    Querystring: QueryParams;
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id } = request.params;
    const {
      status,
      imageId,
      tusUploadId,
      startedFrom,
      startedTo,
      finishedFrom,
      finishedTo,
      includeParts = true,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query;

    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    const whereClause: Record<string, unknown> = {
      specimenId: specimen.id,
    };

    if (status) {
      whereClause.status = status;
    }
    if (imageId) {
      whereClause.imageId = imageId;
    }
    if (tusUploadId) {
      whereClause.tusUploadId = tusUploadId;
    }

    if (startedFrom !== undefined || startedTo !== undefined) {
      const startFilter: Record<symbol, Date> = {};
      if (startedFrom !== undefined) {
        startFilter[Op.gte] = new Date(startedFrom);
      }
      if (startedTo !== undefined) {
        startFilter[Op.lte] = new Date(startedTo);
      }
      whereClause.uploadStartedAt = startFilter;
    }

    if (finishedFrom !== undefined || finishedTo !== undefined) {
      const finishFilter: Record<symbol, Date> = {};
      if (finishedFrom !== undefined) {
        finishFilter[Op.gte] = new Date(finishedFrom);
      }
      if (finishedTo !== undefined) {
        finishFilter[Op.lte] = new Date(finishedTo);
      }
      whereClause.uploadFinishedAt = finishFilter;
    }

    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    const total = await TusUploadLog.count({
      where: whereClause,
      distinct: true,
      col: 'id',
    });

    const uploads = await TusUploadLog.findAll({
      where: whereClause,
      order: orderClause,
      limit,
      offset,
    });

    const formattedUploads = uploads.map((upload) => {
      const parts: TusUploadPartRecord[] = Array.isArray(upload.parts) ? upload.parts : [];
      const uploadedBytes = parts.reduce((sum, part) => sum + (toNullableNumber(part.partSize) || 0), 0);

      return {
        id: upload.id,
        specimenId: upload.specimenId,
        tusUploadId: upload.tusUploadId,
        status: upload.status,
        requestedImageRef: upload.requestedImageRef,
        imageId: upload.imageId,
        uploadLength: toNullableNumber(upload.uploadLength),
        uploadCreatedAt: toNullableTimestamp(upload.uploadCreatedAt),
        uploadStartedAt: toNullableTimestamp(upload.uploadStartedAt),
        uploadFinishedAt: toNullableTimestamp(upload.uploadFinishedAt),
        failureReason: upload.failureReason,
        s3Path: upload.s3Path,
        metadata: upload.metadata,
        createdAt: upload.createdAt.getTime(),
        updatedAt: upload.updatedAt.getTime(),
        partCount: parts.length,
        uploadedBytes,
        parts: includeParts
          ? parts.map((part) => ({
              partNumber: part.partNumber,
              partSize: toNullableNumber(part.partSize),
              uploadOffset: toNullableNumber(part.uploadOffset),
              uploadedAt: new Date(part.uploadedAt).getTime(),
            }))
          : null,
      };
    });

    return reply.code(200).send({
      uploads: formattedUploads,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
