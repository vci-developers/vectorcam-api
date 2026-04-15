import { FastifyRequest, FastifyReply } from 'fastify';
import { QueryTypes } from 'sequelize';
import sequelize from '../../db/index';

interface GetAnnotationSummaryQuery {
  district?: string;
  siteId?: number;
  startDate?: string;
  endDate?: string;
}

interface GetAnnotationSummaryRequest extends FastifyRequest {
  query: GetAnnotationSummaryQuery;
}

type AnnotationStatus = 'PENDING' | 'ANNOTATED' | 'FLAGGED';
type MatrixAttribute = 'species' | 'sex' | 'abdomenStatus';

interface StatusCountRow {
  status: AnnotationStatus;
  count: number | string;
}

interface MatrixCountRow {
  annotatedValue: string | null;
  predictedValue: string | null;
  count: number | string;
}

interface ConfusionMatrix {
  columns: string[];
  data: Array<{
    rowLabel: string;
    values: Record<string, number>;
  }>;
}

function normalizeLabel(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'UNKNOWN';
}

function buildConfusionMatrix(rows: MatrixCountRow[]): ConfusionMatrix {
  const rowLabels = new Set<string>();
  const columnLabels = new Set<string>();
  const countsByRow = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const annotatedLabel = normalizeLabel(row.annotatedValue);
    const predictedLabel = normalizeLabel(row.predictedValue);
    const count = Number(row.count);

    rowLabels.add(annotatedLabel);
    columnLabels.add(predictedLabel);

    if (!countsByRow.has(annotatedLabel)) {
      countsByRow.set(annotatedLabel, new Map<string, number>());
    }

    const rowCounts = countsByRow.get(annotatedLabel)!;
    rowCounts.set(predictedLabel, (rowCounts.get(predictedLabel) ?? 0) + count);
  }

  const sortedColumns = Array.from(columnLabels).sort((a, b) => a.localeCompare(b));
  const sortedRows = Array.from(rowLabels).sort((a, b) => a.localeCompare(b));

  const data = sortedRows.map((rowLabel) => {
    const rowCounts = countsByRow.get(rowLabel) ?? new Map<string, number>();
    const values: Record<string, number> = {};

    for (const columnLabel of sortedColumns) {
      values[columnLabel] = rowCounts.get(columnLabel) ?? 0;
    }

    return {
      rowLabel,
      values
    };
  });

  return {
    columns: sortedColumns,
    data
  };
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Get annotation status summary',
  description: 'Get annotation counts grouped by status with optional location and date filters',
  querystring: {
    type: 'object',
    properties: {
      district: { type: 'string', description: 'Filter annotations by site district' },
      siteId: { type: 'number', description: 'Filter annotations by site ID' },
      startDate: { type: 'string', format: 'date', description: 'Filter annotations created from this date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Filter annotations created to this date (YYYY-MM-DD)' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        statusCounts: {
          type: 'object',
          properties: {
            PENDING: { type: 'number' },
            ANNOTATED: { type: 'number' },
            FLAGGED: { type: 'number' }
          }
        },
        confusionMatrices: {
          type: 'object',
          properties: {
            species: {
              type: 'object',
              properties: {
                columns: { type: 'array', items: { type: 'string' } },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowLabel: { type: 'string' },
                      values: { type: 'object', additionalProperties: { type: 'number' } }
                    }
                  }
                }
              }
            },
            sex: {
              type: 'object',
              properties: {
                columns: { type: 'array', items: { type: 'string' } },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowLabel: { type: 'string' },
                      values: { type: 'object', additionalProperties: { type: 'number' } }
                    }
                  }
                }
              }
            },
            abdomenStatus: {
              type: 'object',
              properties: {
                columns: { type: 'array', items: { type: 'string' } },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowLabel: { type: 'string' },
                      values: { type: 'object', additionalProperties: { type: 'number' } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export default async function getAnnotationSummary(
  request: GetAnnotationSummaryRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { district, siteId, startDate, endDate } = request.query;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    const whereClauses: string[] = [];
    const replacements: Record<string, string | number | Date> = {};

    if (startDate) {
      replacements.startDate = new Date(startDate);
      whereClauses.push('a.created_at >= :startDate');
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      replacements.endDate = endDateTime;
      whereClauses.push('a.created_at <= :endDate');
    }
    if (district) {
      replacements.district = district;
      whereClauses.push('s.district = :district');
    }
    if (siteId) {
      replacements.siteId = siteId;
      whereClauses.push('s.id = :siteId');
    }

    const whereSql = whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

    const statusCountQuery = `
      SELECT a.status AS status, COUNT(a.id) AS count
      FROM annotations a
      INNER JOIN specimens sp ON a.specimen_id = sp.id
      INNER JOIN sessions sess ON sp.session_id = sess.id
      INNER JOIN sites s ON sess.site_id = s.id
      WHERE 1 = 1
      ${whereSql}
      GROUP BY a.status
    `;

    const groupedCounts = await sequelize.query(statusCountQuery, {
      replacements,
      type: QueryTypes.SELECT
    }) as StatusCountRow[];

    const statusCounts: Record<AnnotationStatus, number> = {
      PENDING: 0,
      ANNOTATED: 0,
      FLAGGED: 0
    };

    for (const row of groupedCounts) {
      statusCounts[row.status] = Number(row.count);
    }

    const total = statusCounts.PENDING + statusCounts.ANNOTATED + statusCounts.FLAGGED;

    const matrixQueries: Record<MatrixAttribute, string> = {
      species: `
        SELECT a.visual_species AS annotatedValue, si.species AS predictedValue, COUNT(a.id) AS count
        FROM annotations a
        INNER JOIN specimens sp ON a.specimen_id = sp.id
        INNER JOIN sessions sess ON sp.session_id = sess.id
        INNER JOIN sites s ON sess.site_id = s.id
        LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
        WHERE a.status = 'ANNOTATED'
        ${whereSql}
        GROUP BY a.visual_species, si.species
      `,
      sex: `
        SELECT a.visual_sex AS annotatedValue, si.sex AS predictedValue, COUNT(a.id) AS count
        FROM annotations a
        INNER JOIN specimens sp ON a.specimen_id = sp.id
        INNER JOIN sessions sess ON sp.session_id = sess.id
        INNER JOIN sites s ON sess.site_id = s.id
        LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
        WHERE a.status = 'ANNOTATED'
        ${whereSql}
        GROUP BY a.visual_sex, si.sex
      `,
      abdomenStatus: `
        SELECT a.visual_abdomen_status AS annotatedValue, si.abdomen_status AS predictedValue, COUNT(a.id) AS count
        FROM annotations a
        INNER JOIN specimens sp ON a.specimen_id = sp.id
        INNER JOIN sessions sess ON sp.session_id = sess.id
        INNER JOIN sites s ON sess.site_id = s.id
        LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
        WHERE a.status = 'ANNOTATED'
        ${whereSql}
        GROUP BY a.visual_abdomen_status, si.abdomen_status
      `
    };

    const [speciesRows, sexRows, abdomenStatusRows] = await Promise.all([
      sequelize.query(matrixQueries.species, { replacements, type: QueryTypes.SELECT }) as Promise<MatrixCountRow[]>,
      sequelize.query(matrixQueries.sex, { replacements, type: QueryTypes.SELECT }) as Promise<MatrixCountRow[]>,
      sequelize.query(matrixQueries.abdomenStatus, { replacements, type: QueryTypes.SELECT }) as Promise<MatrixCountRow[]>
    ]);

    return reply.code(200).send({
      total,
      statusCounts,
      confusionMatrices: {
        species: buildConfusionMatrix(speciesRows),
        sex: buildConfusionMatrix(sexRows),
        abdomenStatus: buildConfusionMatrix(abdomenStatusRows)
      }
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
