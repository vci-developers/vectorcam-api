import { FastifyRequest, FastifyReply } from 'fastify';
import { QueryTypes } from 'sequelize';
import sequelize from '../../db/index';
import { handleError } from './common';
import {
  countHousesUsedForCollection,
  resolveMetricsFormContext,
  resolveMetricsSiteScope,
} from './metricsSiteScope';
import {
  hasRequiredSurveillanceMappings,
  resolveSurveillanceQuestionMappings,
  SurveillanceQuestionMapping,
} from './metricsSurveillanceQuestions';

interface MetricsQuery {
  district?: string;
  programId?: string;
  siteIds?: string;
  startDate: string;
  endDate: string;
}

const METRIC_LABELS = {
  siteInformation: {
    housesUsedForCollection: 'Houses used for collection',
    peopleInAllHousesInspected: 'People in all houses inspected',
  },
  entomologicalSummary: {
    totalFedAnopheles: 'Total fed anopheles',
    malariaVectorDensity: 'Malaria vector density',
    fedAnophelesToPeopleSleptRatio: 'Fed anopheles to people slept under LLIN ratio',
    totalLlins: 'Total LLINs',
    totalPeopleSleptUnderLlin: 'Total people slept under LLIN',
    llinsPerPerson: 'LLINs per person',
    // for backward compatibility
    vectorDensity: 'Vector density',
    fedMosquitoesToPeopleSleptRatio: 'Fed mosquitoes to people slept ratio',
  }
} as const;

export const schema = {
  tags: ['Sessions'],
  description: 'Get session metrics for a district, program, or site subtree and date range',
  querystring: {
    type: 'object',
    properties: {
      district: { type: 'string', description: 'Filter by legacy district name' },
      programId: { type: 'integer', description: 'Filter by program ID' },
      siteIds: { type: 'string', description: 'Comma-separated site IDs (includes descendant sites)' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' }
    },
    required: ['startDate', 'endDate']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        siteInformation: {
          type: 'object',
          properties: {
            housesUsedForCollection: { type: 'number' },
            peopleInAllHousesInspected: { type: 'number' }
          }
        },
        entomologicalSummary: {
          type: 'object',
          properties: {
            totalFedAnopheles: { type: 'number' },
            malariaVectorDensity: { type: 'number' },
            fedAnophelesToPeopleSleptRatio: { type: 'number' },
            totalLlins: { type: 'number' },
            totalPeopleSleptUnderLlin: { type: 'number' },
            llinsPerPerson: { type: 'number' },

            // for backward compatibility
            vectorDensity: { type: 'number' },
            fedMosquitoesToPeopleSleptRatio: { type: 'number' },
          }
        },
        metricLabels: {
          type: 'object',
          properties: {
            siteInformation: {
              type: 'object',
              properties: {
                housesUsedForCollection: { type: 'string' },
                peopleInAllHousesInspected: { type: 'string' }
              }
            },
            entomologicalSummary: {
              type: 'object',
              properties: {
                totalFedAnopheles: { type: 'string' },
                malariaVectorDensity: { type: 'string' },
                fedAnophelesToPeopleSleptRatio: { type: 'string' },
                totalLlins: { type: 'string' },
                totalPeopleSleptUnderLlin: { type: 'string' },
                llinsPerPerson: { type: 'string' },
                vectorDensity: { type: 'string' },
                fedMosquitoesToPeopleSleptRatio: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};

function emptyMetricsResponse() {
  return {
    siteInformation: {
      housesUsedForCollection: 0,
      peopleInAllHousesInspected: 0,
    },
    entomologicalSummary: {
      totalFedAnopheles: 0,
      malariaVectorDensity: 0,
      fedAnophelesToPeopleSleptRatio: 0,
      totalLlins: 0,
      totalPeopleSleptUnderLlin: 0,
      llinsPerPerson: 0,
      vectorDensity: 0,
      fedMosquitoesToPeopleSleptRatio: 0,
    },
    metricLabels: METRIC_LABELS,
  };
}

function numericAnswerSql(questionId: number, alias: string): string {
  return `MAX(CASE
    WHEN fa.question_id = ${questionId}
    THEN CAST(JSON_UNQUOTE(fa.value) AS DECIMAL(20, 4))
  END) AS ${alias}`;
}

function buildNumericExpression(mapping: SurveillanceQuestionMapping, alias: string): string {
  if (mapping.kind === 'single') {
    return numericAnswerSql(mapping.questionId, alias);
  }

  const parts = mapping.questionIds.map(
    (questionId, index) => `COALESCE(${alias}_part_${index}, 0)`
  );
  const selects = mapping.questionIds.map(
    (questionId, index) => numericAnswerSql(questionId, `${alias}_part_${index}`)
  );

  return `${selects.join(',\n        ')},
        (${parts.join(' + ')}) AS ${alias}`;
}

interface HouseholdMetricsRow {
  site_id: number;
  num_people_slept_in_house: number | null;
  num_llins_available: number | null;
  num_people_slept_under_llin: number | null;
}

async function loadLegacyHouseholdMetrics(
  siteIds: number[],
  startDate: Date,
  endDate: Date
): Promise<{ peopleInAllHousesInspected: number; rows: HouseholdMetricsRow[] }> {
  const peopleInHousesQuery = `
    SELECT COALESCE(SUM(num_people_slept_in_house), 0) as totalPeople
    FROM (
      SELECT
        sess.site_id,
        MAX(sf.num_people_slept_in_house) as num_people_slept_in_house
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
      WHERE s.id IN (:siteIds)
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sf.num_people_slept_in_house IS NOT NULL
      GROUP BY sess.site_id
    ) as unique_houses
  `;

  const peopleResult = await sequelize.query(peopleInHousesQuery, {
    replacements: { siteIds, startDate, endDate },
    type: QueryTypes.SELECT,
  }) as Array<{ totalPeople: number }>;

  const surveillanceDataQuery = `
    SELECT
      sess.site_id,
      sf.num_people_slept_in_house,
      sf.num_llins_available,
      sf.num_people_slept_under_llin
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
    WHERE s.id IN (:siteIds)
      AND sess.collection_date >= :startDate
      AND sess.collection_date < :endDate
      AND sess.type = 'SURVEILLANCE'
    GROUP BY sess.site_id, sf.num_people_slept_in_house,
             sf.num_llins_available, sf.num_people_slept_under_llin
  `;

  const rows = await sequelize.query(surveillanceDataQuery, {
    replacements: { siteIds, startDate, endDate },
    type: QueryTypes.SELECT,
  }) as HouseholdMetricsRow[];

  return {
    peopleInAllHousesInspected: peopleResult[0]?.totalPeople || 0,
    rows,
  };
}

async function loadFormHouseholdMetrics(
  siteIds: number[],
  startDate: Date,
  endDate: Date,
  formId: number,
  mappings: ReturnType<typeof resolveSurveillanceQuestionMappings>
): Promise<{ peopleInAllHousesInspected: number; rows: HouseholdMetricsRow[] }> {
  const peopleMapping = mappings.numPeopleSleptInHouse!;
  const llinsMapping = mappings.numLlinsAvailable!;
  const underLlinMapping = mappings.numPeopleSleptUnderLlin!;

  const perSessionQuery = `
    SELECT
      sess.site_id,
      sess.id AS session_id,
      ${buildNumericExpression(peopleMapping, 'num_people_slept_in_house')},
      ${buildNumericExpression(llinsMapping, 'num_llins_available')},
      ${buildNumericExpression(underLlinMapping, 'num_people_slept_under_llin')}
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN form_answers fa ON fa.session_id = sess.id AND fa.form_id = :formId
    WHERE s.id IN (:siteIds)
      AND sess.collection_date >= :startDate
      AND sess.collection_date < :endDate
      AND sess.type = 'SURVEILLANCE'
    GROUP BY sess.site_id, sess.id
  `;

  const perSiteQuery = `
    SELECT
      site_id,
      MAX(num_people_slept_in_house) AS num_people_slept_in_house,
      MAX(num_llins_available) AS num_llins_available,
      MAX(num_people_slept_under_llin) AS num_people_slept_under_llin
    FROM (${perSessionQuery}) AS per_session
    GROUP BY site_id, num_people_slept_in_house, num_llins_available, num_people_slept_under_llin
  `;

  const peopleInHousesQuery = `
    SELECT COALESCE(SUM(num_people_slept_in_house), 0) AS totalPeople
    FROM (
      SELECT
        site_id,
        MAX(num_people_slept_in_house) AS num_people_slept_in_house
      FROM (${perSessionQuery}) AS per_session
      WHERE num_people_slept_in_house IS NOT NULL
      GROUP BY site_id
    ) AS unique_houses
  `;

  const [peopleResult, rows] = await Promise.all([
    sequelize.query(peopleInHousesQuery, {
      replacements: { siteIds, startDate, endDate, formId },
      type: QueryTypes.SELECT,
    }) as Promise<Array<{ totalPeople: number }>>,
    sequelize.query(perSiteQuery, {
      replacements: { siteIds, startDate, endDate, formId },
      type: QueryTypes.SELECT,
    }) as Promise<HouseholdMetricsRow[]>,
  ]);

  return {
    peopleInAllHousesInspected: peopleResult[0]?.totalPeople || 0,
    rows,
  };
}

async function loadEntomologicalMetrics(
  siteIds: number[],
  startDate: Date,
  endDate: Date
): Promise<{
  totalFedAnopheles: number;
  totalAnopheles: number;
  totalMosquitoes: number;
}> {
  const fedAnophelesQuery = `
    SELECT
      COUNT(DISTINCT CASE
        WHEN si.abdomen_status IN ('Fully fed')
          AND si.species LIKE '%anopheles%'
        THEN sp.id
      END) as totalFedAnopheles
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN specimens sp ON sess.id = sp.session_id
    LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
    WHERE s.id IN (:siteIds)
      AND sess.collection_date >= :startDate
      AND sess.collection_date < :endDate
      AND sess.type = 'SURVEILLANCE'
  `;

  const malariaVectorDensityQuery = `
    SELECT
      COUNT(DISTINCT CASE
        WHEN si.species LIKE '%anopheles%'
        THEN sp.id
      END) as totalAnopheles,
      COUNT(DISTINCT CASE
        WHEN si.species NOT LIKE '%non mosquito%'
          AND si.species IS NOT NULL
        THEN sp.id
      END) as totalMosquitoes
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN specimens sp ON sess.id = sp.session_id
    LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
    WHERE s.id IN (:siteIds)
      AND sess.collection_date >= :startDate
      AND sess.collection_date < :endDate
      AND sess.type = 'SURVEILLANCE'
  `;

  const fedAnophelesResult = await sequelize.query(fedAnophelesQuery, {
    replacements: { siteIds, startDate, endDate },
    type: QueryTypes.SELECT,
  }) as Array<{ totalFedAnopheles: number }>;

  const vectorDensityResult = await sequelize.query(malariaVectorDensityQuery, {
    replacements: { siteIds, startDate, endDate },
    type: QueryTypes.SELECT,
  }) as Array<{ totalAnopheles: number; totalMosquitoes: number }>;

  return {
    totalFedAnopheles: fedAnophelesResult[0]?.totalFedAnopheles || 0,
    totalAnopheles: vectorDensityResult[0]?.totalAnopheles || 0,
    totalMosquitoes: vectorDensityResult[0]?.totalMosquitoes || 0,
  };
}

function sumHouseholdRows(rows: HouseholdMetricsRow[]): {
  totalLlins: number;
  totalPeopleSleptUnderLlin: number;
} {
  let totalLlins = 0;
  let totalPeopleSleptUnderLlin = 0;

  for (const house of rows) {
    if (house.num_llins_available !== null) {
      totalLlins += Number(house.num_llins_available);
    }
    if (house.num_people_slept_under_llin !== null) {
      totalPeopleSleptUnderLlin += Number(house.num_people_slept_under_llin);
    }
  }

  return { totalLlins, totalPeopleSleptUnderLlin };
}

export async function getMetrics(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = request.query as MetricsQuery;
    const { startDate: startDateStr, endDate: endDateStr } = query;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return reply.code(400).send({ error: 'Invalid date format. Use YYYY-MM-DD format.' });
    }

    if (startDate >= endDate) {
      return reply.code(400).send({ error: 'startDate must be before endDate' });
    }

    const siteScope = await resolveMetricsSiteScope(request, reply, query);
    if (!siteScope) {
      return;
    }

    if (siteScope.filteredSiteIds.length === 0) {
      return reply.send(emptyMetricsResponse());
    }

    const parsedProgramId = query.programId ? Number(query.programId) : undefined;
    const metricsProgramId = parsedProgramId ?? (
      siteScope.programIds.length === 1 ? siteScope.programIds[0] : undefined
    );

    let useFormMetrics = false;
    let formId: number | undefined;
    let questionMappings: ReturnType<typeof resolveSurveillanceQuestionMappings> | undefined;

    if (metricsProgramId !== undefined) {
      const formContext = await resolveMetricsFormContext(metricsProgramId);
      if (formContext) {
        const mappings = resolveSurveillanceQuestionMappings(formContext.questions);
        if (hasRequiredSurveillanceMappings(mappings)) {
          useFormMetrics = true;
          formId = formContext.formId;
          questionMappings = mappings;
        }
      }
    }

    const sessionSiteIds = useFormMetrics && siteScope.collectionSiteIds.length > 0
      ? siteScope.collectionSiteIds
      : siteScope.filteredSiteIds;

    const housesUsedForCollection = await countHousesUsedForCollection(
      siteScope.filteredSites,
      siteScope.collectionSiteIds,
      useFormMetrics
    );

    const householdMetrics = useFormMetrics && formId && questionMappings
      ? await loadFormHouseholdMetrics(
        sessionSiteIds,
        startDate,
        endDate,
        formId,
        questionMappings
      )
      : await loadLegacyHouseholdMetrics(sessionSiteIds, startDate, endDate);

    const { totalLlins, totalPeopleSleptUnderLlin } = sumHouseholdRows(householdMetrics.rows);
    const {
      totalFedAnopheles,
      totalAnopheles,
      totalMosquitoes,
    } = await loadEntomologicalMetrics(sessionSiteIds, startDate, endDate);

    const peopleInAllHousesInspected = householdMetrics.peopleInAllHousesInspected;

    const llinsPerPerson = peopleInAllHousesInspected > 0
      ? totalLlins / peopleInAllHousesInspected
      : 0;

    const fedAnophelesToPeopleSleptRatio = totalPeopleSleptUnderLlin > 0
      ? totalFedAnopheles / totalPeopleSleptUnderLlin
      : 0;

    const malariaVectorDensity = totalMosquitoes > 0
      ? totalAnopheles / totalMosquitoes
      : 0;

    return reply.send({
      siteInformation: {
        housesUsedForCollection,
        peopleInAllHousesInspected,
      },
      entomologicalSummary: {
        totalFedAnopheles,
        malariaVectorDensity: Number(malariaVectorDensity.toFixed(2)),
        fedAnophelesToPeopleSleptRatio: Number(fedAnophelesToPeopleSleptRatio.toFixed(2)),
        totalLlins,
        totalPeopleSleptUnderLlin,
        llinsPerPerson: Number(llinsPerPerson.toFixed(2)),

        // for backward compatibility
        vectorDensity: Number(malariaVectorDensity.toFixed(2)),
        fedMosquitoesToPeopleSleptRatio: Number(fedAnophelesToPeopleSleptRatio.toFixed(2)),
      },
      metricLabels: METRIC_LABELS,
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session metrics');
  }
}
