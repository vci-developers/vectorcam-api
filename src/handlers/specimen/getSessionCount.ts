import { FastifyRequest, FastifyReply } from 'fastify';
import { Site } from '../../db/models';
import { Op, QueryTypes, fn, col, where, literal } from 'sequelize';
import sequelize from '../../db/index';
import { buildSiteSubtreeWhere, expandSiteIdsWithDescendants, parseSiteIds } from '../site/common';

interface QueryParams {
  programId?: number;
  hasImages?: boolean;
  startDate?: string;
  endDate?: string;
  district?: string;
  siteIds?: string;
  sessionId?: string;
  sessionType?: string;
  locationTypeKey?: string;
  locationTypeValue?: string;
}

interface GroupRow {
  sessionId: number;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
  count: number | string;
}

interface ImageCountRow {
  sessionId: number;
  imageCount: number | string;
}

function buildSessionFilterSql(
  sessionType?: string,
  sessionId?: string,
  startDate?: string,
  endDate?: string
): { sql: string; replacements: Record<string, unknown> } {
  let sql = '';
  const replacements: Record<string, unknown> = {};

  if (sessionType) {
    sql += ' AND sess.type = :sessionType';
    replacements.sessionType = sessionType;
  }
  if (sessionId) {
    sql += ' AND sess.id = :sessionId';
    replacements.sessionId = sessionId;
  }
  if (startDate) {
    sql += ' AND sess.collection_date >= :startDate';
    replacements.startDate = new Date(startDate);
  }
  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    sql += ' AND sess.collection_date < :endDate';
    replacements.endDate = endDateObj;
  }

  return { sql, replacements };
}

export const schema = {
  tags: ['Specimens'],
  description:
    'Specimen counts grouped by session for a program, with optional filter to specimens that have images',
  querystring: {
    type: 'object',
    required: ['programId'],
    properties: {
      programId: { type: 'number', description: 'Filter sessions by program ID (via site)' },
      hasImages: {
        type: 'boolean',
        description: 'When true, specimen counts and groups include only specimens with at least one image',
      },
      startDate: {
        type: 'string',
        format: 'date',
        description: 'Filter specimens from sessions with collection date from this date (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        format: 'date',
        description: 'Filter specimens from sessions with collection date to this date (YYYY-MM-DD)',
      },
      district: {
        type: 'string',
        description: 'Filter specimens by district name',
      },
      siteIds: {
        type: 'string',
        description: 'Comma-separated site IDs to filter by (includes descendant sites)',
      },
      sessionId: {
        type: 'string',
        description: 'Filter specimens by session ID',
      },
      sessionType: {
        type: 'string',
        enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'],
        description: 'Filter specimens by session type',
      },
      locationTypeKey: {
        type: 'string',
        description: 'Filter by location type name key in location hierarchy',
      },
      locationTypeValue: {
        type: 'string',
        description: 'Filter by site name value for given location type key',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              specimenCount: { type: 'number' },
              imageCount: { type: 'number' },
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    species: { type: ['string', 'null'] },
                    sex: { type: ['string', 'null'] },
                    abdomenStatus: { type: ['string', 'null'] },
                    count: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function getSpecimenSessionCount(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      programId,
      hasImages,
      startDate,
      endDate,
      district,
      siteIds,
      sessionId,
      sessionType,
      locationTypeKey,
      locationTypeValue,
    } = request.query;
    const requestedSiteIds = parseSiteIds(siteIds);

    if (programId === undefined || !Number.isInteger(programId) || programId <= 0) {
      return reply.code(400).send({ error: 'programId must be a positive integer' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    const siteAccess = request.siteAccess;
    if (!siteAccess?.canRead) {
      return reply.code(403).send({
        error: 'Forbidden: Insufficient permissions to access specimen data',
      });
    }

    const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);

    const siteWhere: any = { programId };
    if (accessibleSiteIds.length > 0) {
      siteWhere.id = { [Op.in]: accessibleSiteIds };
    }

    if (district) {
      siteWhere.district = district;
    }

    if (requestedSiteIds.length > 0) {
      const subtreeWhere = buildSiteSubtreeWhere(requestedSiteIds);
      if (subtreeWhere) {
        siteWhere[Op.and] = [...((siteWhere[Op.and] as any[]) ?? []), subtreeWhere];
      }
    }

    if (locationTypeKey && locationTypeValue) {
      siteWhere[Op.and] = [
        ...(siteWhere[Op.and] || []),
        where(
          fn(
            'JSON_CONTAINS',
            fn(
              'JSON_EXTRACT',
              fn('COALESCE', col('location_hierarchy'), literal('JSON_OBJECT()')),
              literal("'$.hierarchy'")
            ),
            fn('JSON_OBJECT', 'locationType', locationTypeKey, 'value', locationTypeValue)
          ),
          1
        ),
      ];
    }

    const sites = await Site.findAll({
      where: siteWhere,
      attributes: ['id'],
    });

    const filteredSiteIds = sites.map((site) => site.id);
    if (filteredSiteIds.length === 0) {
      return reply.send({ sessions: [] });
    }

    const siteIdList = filteredSiteIds.join(',');
    const hasImagesFilter = hasImages
      ? `AND EXISTS (SELECT 1 FROM specimen_images img WHERE img.specimen_id = sp.id)`
      : '';

    const { sql: sessionFilterSql, replacements } = buildSessionFilterSql(
      sessionType,
      sessionId,
      startDate,
      endDate
    );

    const groupQuery = `
      SELECT
        sess.id AS sessionId,
        si.species AS species,
        si.sex AS sex,
        si.abdomen_status AS abdomenStatus,
        COUNT(sp.id) AS count
      FROM specimens sp
      INNER JOIN sessions sess ON sp.session_id = sess.id
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE s.id IN (${siteIdList})
        ${hasImagesFilter}
        ${sessionFilterSql}
      GROUP BY
        sess.id,
        si.species,
        si.sex,
        si.abdomen_status
      ORDER BY sess.id, si.species, si.sex, si.abdomen_status
    `;

    const imageCountQuery = `
      SELECT
        sess.id AS sessionId,
        COUNT(img.id) AS imageCount
      FROM specimen_images img
      INNER JOIN specimens sp ON img.specimen_id = sp.id
      INNER JOIN sessions sess ON sp.session_id = sess.id
      INNER JOIN sites s ON sess.site_id = s.id
      WHERE s.id IN (${siteIdList})
        ${sessionFilterSql}
      GROUP BY sess.id
    `;

    const queryOptions = { replacements, type: QueryTypes.SELECT };

    const [groupRows, imageCountRows] = await Promise.all([
      sequelize.query(groupQuery, queryOptions) as Promise<GroupRow[]>,
      sequelize.query(imageCountQuery, queryOptions) as Promise<ImageCountRow[]>,
    ]);

    const imageCountBySession = new Map<number, number>();
    for (const row of imageCountRows) {
      imageCountBySession.set(Number(row.sessionId), Number(row.imageCount));
    }

    const sessionsById = new Map<
      number,
      {
        sessionId: number;
        specimenCount: number;
        imageCount: number;
        groups: Array<{
          species: string | null;
          sex: string | null;
          abdomenStatus: string | null;
          count: number;
        }>;
      }
    >();

    for (const row of groupRows) {
      const sessionIdNum = Number(row.sessionId);
      const count = Number(row.count);

      let session = sessionsById.get(sessionIdNum);
      if (!session) {
        session = {
          sessionId: sessionIdNum,
          specimenCount: 0,
          imageCount: imageCountBySession.get(sessionIdNum) ?? 0,
          groups: [],
        };
        sessionsById.set(sessionIdNum, session);
      }

      session.specimenCount += count;
      session.groups.push({
        species: row.species,
        sex: row.sex,
        abdomenStatus: row.abdomenStatus,
        count,
      });
    }

    const sessions = Array.from(sessionsById.values()).sort((a, b) => a.sessionId - b.sessionId);

    return reply.send({ sessions });
  } catch (error: unknown) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal server error while retrieving session specimen counts',
    });
  }
}
