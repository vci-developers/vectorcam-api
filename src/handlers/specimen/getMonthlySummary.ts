import { FastifyReply, FastifyRequest } from 'fastify';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../../db/index';
import { Site } from '../../db/models';
import { buildSiteSubtreeWhere, expandSiteIdsWithDescendants } from '../site/common';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  districts?: string;
  siteIds?: string;
  sessionType?: string;
}

interface SummaryRow {
  monthStart: string;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
  count: number | string;
}

interface MonthlyBucket {
  fromTimestamp: number;
  toTimestamp: number;
  from: string;
  to: string;
  species: Record<string, number>;
  sex: Record<string, number>;
  abdomenStatus: Record<string, number>;
  totalSpecimens: number;
}

function parseCommaSeparated(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseSiteIds(value?: string): number[] {
  return parseCommaSeparated(value)
    .map((entry) => Number(entry))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function normalizeLabel(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'UNKNOWN';
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthBoundsFromKey(monthStartKey: string): { from: Date; to: Date } {
  const from = new Date(`${monthStartKey}T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

function getMonthKeysBetween(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cursor <= end) {
    keys.push(toIsoDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

export const schema = {
  tags: ['Specimens'],
  description: 'Get monthly specimen summary grouped by species, sex, and abdomen status',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      districts: { type: 'string', description: 'Comma-separated district names' },
      siteIds: { type: 'string', description: 'Comma-separated site IDs' },
      sessionType: {
        type: 'string',
        enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'],
        description: 'Filter by session type',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        interval: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fromTimestamp: { type: 'number' },
              toTimestamp: { type: 'number' },
              from: { type: 'string' },
              to: { type: 'string' },
              species: { type: 'object', additionalProperties: { type: 'number' } },
              sex: { type: 'object', additionalProperties: { type: 'number' } },
              abdomenStatus: { type: 'object', additionalProperties: { type: 'number' } },
              totalSpecimens: { type: 'number' },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    403: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export async function getSpecimenMonthlySummary(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, districts, siteIds, sessionType } = request.query;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    const siteAccess = request.siteAccess;
    if (!siteAccess?.canRead) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access specimen data' });
    }

    const requestedDistricts = parseCommaSeparated(districts);
    const requestedSiteIds = parseSiteIds(siteIds);
    const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);

    const siteWhere: any = {
      hasData: true,
    };

    if (requestedDistricts.length > 0) {
      siteWhere.district = { [Op.in]: requestedDistricts };
    }

    // Requested siteIds: match any Site whose subtree covers one of the requested ids via
    // the JSON siteIds field, without pre-expanding.
    if (requestedSiteIds.length > 0) {
      const subtreeFragment = buildSiteSubtreeWhere(requestedSiteIds);
      if (subtreeFragment) {
        siteWhere[Op.and] = [...((siteWhere[Op.and] as any[]) ?? []), subtreeFragment];
      }
    }

    if (accessibleSiteIds.length > 0) {
      siteWhere.id = { [Op.in]: accessibleSiteIds };
    }

    const sites = await Site.findAll({
      where: siteWhere,
      attributes: ['id'],
    });
    const filteredSiteIds = sites.map((site) => site.id);

    if (filteredSiteIds.length === 0) {
      return reply.send({ interval: 'MONTH', data: [] });
    }

    const replacements: Record<string, unknown> = {
      siteIds: filteredSiteIds,
    };
    const whereClauses = [
      'sess.collection_date IS NOT NULL',
      's.id IN (:siteIds)',
    ];

    if (startDate) {
      replacements.startDate = new Date(`${startDate}T00:00:00.000Z`);
      whereClauses.push('sess.collection_date >= :startDate');
    }
    if (endDate) {
      const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      replacements.endDate = endExclusive;
      whereClauses.push('sess.collection_date < :endDate');
    }
    if (sessionType) {
      replacements.sessionType = sessionType;
      whereClauses.push('sess.type = :sessionType');
    }

    const rows = await sequelize.query(
      `
        SELECT
          DATE_FORMAT(sess.collection_date, '%Y-%m-01') AS monthStart,
          si.species AS species,
          si.sex AS sex,
          si.abdomen_status AS abdomenStatus,
          COUNT(sp.id) AS count
        FROM specimens sp
        INNER JOIN sessions sess ON sp.session_id = sess.id
        INNER JOIN sites s ON sess.site_id = s.id
        LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY
          DATE_FORMAT(sess.collection_date, '%Y-%m-01'),
          si.species,
          si.sex,
          si.abdomen_status
        ORDER BY DATE_FORMAT(sess.collection_date, '%Y-%m-01') ASC
      `,
      { replacements, type: QueryTypes.SELECT }
    ) as SummaryRow[];

    const buckets = new Map<string, MonthlyBucket>();

    for (const row of rows) {
      const monthKey = row.monthStart;
      if (!buckets.has(monthKey)) {
        const { from, to } = monthBoundsFromKey(monthKey);
        buckets.set(monthKey, {
          fromTimestamp: from.getTime(),
          toTimestamp: to.getTime(),
          from: toIsoDate(from),
          to: toIsoDate(to),
          species: {},
          sex: {},
          abdomenStatus: {},
          totalSpecimens: 0,
        });
      }

      const bucket = buckets.get(monthKey)!;
      const count = Number(row.count);
      const speciesLabel = normalizeLabel(row.species);
      const sexLabel = normalizeLabel(row.sex);
      const abdomenLabel = normalizeLabel(row.abdomenStatus);

      bucket.species[speciesLabel] = (bucket.species[speciesLabel] ?? 0) + count;
      bucket.sex[sexLabel] = (bucket.sex[sexLabel] ?? 0) + count;
      bucket.abdomenStatus[abdomenLabel] = (bucket.abdomenStatus[abdomenLabel] ?? 0) + count;
      bucket.totalSpecimens += count;
    }

    if (startDate && endDate) {
      const monthKeys = getMonthKeysBetween(
        new Date(`${startDate}T00:00:00.000Z`),
        new Date(`${endDate}T00:00:00.000Z`)
      );
      for (const monthKey of monthKeys) {
        if (!buckets.has(monthKey)) {
          const { from, to } = monthBoundsFromKey(monthKey);
          buckets.set(monthKey, {
            fromTimestamp: from.getTime(),
            toTimestamp: to.getTime(),
            from: toIsoDate(from),
            to: toIsoDate(to),
            species: {},
            sex: {},
            abdomenStatus: {},
            totalSpecimens: 0,
          });
        }
      }
    }

    const data = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);

    return reply.send({
      interval: 'MONTH',
      data,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to retrieve monthly specimen summary' });
  }
}
