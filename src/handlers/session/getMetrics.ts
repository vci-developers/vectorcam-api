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
  SurveillanceQuestionMapping,
  SurveillanceQuestionMappings,
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
    housesSprayedInLast12Months: 'Houses sprayed in the last 12 months',
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
            peopleInAllHousesInspected: { type: 'number' },
            housesSprayedInLast12Months: { type: ['number', 'null'] },
          }
        },
        entomologicalSummary: {
          type: 'object',
          properties: {
            totalFedAnopheles: { type: 'number' },
            malariaVectorDensity: { type: 'number' },
            fedAnophelesToPeopleSleptRatio: { type: ['number', 'null'] },
            totalLlins: { type: ['number', 'null'] },
            totalPeopleSleptUnderLlin: { type: ['number', 'null'] },
            llinsPerPerson: { type: ['number', 'null'] },

            // for backward compatibility
            vectorDensity: { type: 'number' },
            fedMosquitoesToPeopleSleptRatio: { type: ['number', 'null'] },
          }
        },
        metricLabels: {
          type: 'object',
          properties: {
            siteInformation: {
              type: 'object',
              properties: {
                housesUsedForCollection: { type: 'string' },
                peopleInAllHousesInspected: { type: 'string' },
                housesSprayedInLast12Months: { type: 'string' },
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
                fedMosquitoesToPeopleSleptRatio: { type: 'string' },
              }
            }
          }
        }
      }
    }
  }
};

function emptyMetricsResponse(options: {
  useFormMetrics: boolean;
  mappings?: SurveillanceQuestionMappings;
} = { useFormMetrics: false }) {
  const { useFormMetrics, mappings } = options;
  const hasLlinsMapping = !useFormMetrics || Boolean(mappings?.numLlinsAvailable);
  const hasUnderLlinMapping = !useFormMetrics || Boolean(mappings?.numPeopleSleptUnderLlin);
  const hasIrsMapping = !useFormMetrics || hasIrsQuestionMappings(mappings);

  return {
    siteInformation: {
      housesUsedForCollection: 0,
      peopleInAllHousesInspected: 0,
      housesSprayedInLast12Months: hasIrsMapping ? 0 : null,
    },
    entomologicalSummary: {
      totalFedAnopheles: 0,
      malariaVectorDensity: 0,
      fedAnophelesToPeopleSleptRatio: hasUnderLlinMapping ? 0 : null,
      totalLlins: hasLlinsMapping ? 0 : null,
      totalPeopleSleptUnderLlin: hasUnderLlinMapping ? 0 : null,
      llinsPerPerson: hasLlinsMapping ? 0 : null,
      vectorDensity: 0,
      fedMosquitoesToPeopleSleptRatio: hasUnderLlinMapping ? 0 : null,
    },
    metricLabels: METRIC_LABELS,
  };
}

function hasIrsQuestionMappings(mappings: SurveillanceQuestionMappings | undefined): boolean {
  return Boolean(mappings?.wasIrsConducted && mappings?.monthsSinceIrs);
}

let questionKeyParamCounter = 0;

function resetQuestionKeyParamCounter(): void {
  questionKeyParamCounter = 0;
}

function questionKeysInClause(
  questionKeys: readonly string[],
  prefix: string,
  replacements: Record<string, string>
): string {
  const params = questionKeys.map((key) => {
    const paramName = `${prefix}_${questionKeyParamCounter++}`;
    replacements[paramName] = key;
    return `:${paramName}`;
  });
  return params.join(', ');
}

export function numericAnswerSqlByKeys(
  questionKeys: readonly string[],
  alias: string,
  replacements: Record<string, string>
): string {
  const inClause = questionKeysInClause(questionKeys, alias, replacements);
  return `MAX(CASE
    WHEN fq.question_key IN (${inClause})
    THEN CAST(JSON_UNQUOTE(fa.value) AS DECIMAL(20, 4))
  END) AS ${alias}`;
}

export function booleanAnswerSqlByKeys(
  questionKeys: readonly string[],
  alias: string,
  replacements: Record<string, string>
): string {
  const inClause = questionKeysInClause(questionKeys, alias, replacements);
  return `MAX(CASE
    WHEN fq.question_key IN (${inClause})
    THEN CASE LOWER(TRIM(JSON_UNQUOTE(fa.value)))
      WHEN 'true' THEN 1
      WHEN '1' THEN 1
      WHEN 'false' THEN 0
      WHEN '0' THEN 0
      ELSE NULL
    END
  END) AS ${alias}`;
}

function nullNumericColumn(alias: string): string {
  return `NULL AS ${alias}`;
}

function buildNumericExpression(
  mapping: SurveillanceQuestionMapping,
  alias: string,
  replacements: Record<string, string>
): string {
  if (mapping.kind === 'single') {
    return numericAnswerSqlByKeys(mapping.questionKeys, alias, replacements);
  }

  const parts = mapping.parts.map(
    (_part, index) => `COALESCE(${alias}_part_${index}, 0)`
  );
  const selects = mapping.parts.map(
    (partKeys, index) => numericAnswerSqlByKeys(partKeys, `${alias}_part_${index}`, replacements)
  );

  return `${selects.join(',\n        ')},
        (${parts.join(' + ')}) AS ${alias}`;
}

function buildBooleanExpression(
  mapping: SurveillanceQuestionMapping,
  alias: string,
  replacements: Record<string, string>
): string {
  if (mapping.kind !== 'single') {
    throw new Error(`Boolean metric ${alias} does not support sum mappings`);
  }
  return booleanAnswerSqlByKeys(mapping.questionKeys, alias, replacements);
}

export function formAnswerJoins(): string {
  return `
    LEFT JOIN form_answers fa ON fa.session_id = sess.id
    LEFT JOIN forms f ON f.id = fa.form_id AND f.program_id = :programId
    LEFT JOIN form_questions fq ON fq.id = fa.question_id AND fq.form_id = f.id`;
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
  programId: number,
  mappings: SurveillanceQuestionMappings
): Promise<{ peopleInAllHousesInspected: number; rows: HouseholdMetricsRow[] }> {
  resetQuestionKeyParamCounter();
  const keyReplacements: Record<string, string> = {};
  const peopleExpr = mappings.numPeopleSleptInHouse
    ? buildNumericExpression(mappings.numPeopleSleptInHouse, 'num_people_slept_in_house', keyReplacements)
    : nullNumericColumn('num_people_slept_in_house');
  const llinsExpr = mappings.numLlinsAvailable
    ? buildNumericExpression(mappings.numLlinsAvailable, 'num_llins_available', keyReplacements)
    : nullNumericColumn('num_llins_available');
  const underExpr = mappings.numPeopleSleptUnderLlin
    ? buildNumericExpression(mappings.numPeopleSleptUnderLlin, 'num_people_slept_under_llin', keyReplacements)
    : nullNumericColumn('num_people_slept_under_llin');

  const queryReplacements = {
    siteIds,
    startDate,
    endDate,
    programId,
    ...keyReplacements,
  };
  const joins = formAnswerJoins();

  const perSessionQuery = `
    SELECT
      sess.site_id,
      sess.id AS session_id,
      ${peopleExpr},
      ${llinsExpr},
      ${underExpr}
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    ${joins}
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
      replacements: queryReplacements,
      type: QueryTypes.SELECT,
    }) as Promise<Array<{ totalPeople: number }>>,
    sequelize.query(perSiteQuery, {
      replacements: queryReplacements,
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

async function loadLegacyHousesSprayedInLast12Months(
  siteIds: number[],
  startDate: Date,
  endDate: Date
): Promise<number> {
  const query = `
    SELECT COUNT(DISTINCT sess.site_id) AS housesSprayed
    FROM sessions sess
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
    WHERE s.id IN (:siteIds)
      AND sess.collection_date >= :startDate
      AND sess.collection_date < :endDate
      AND sess.type = 'SURVEILLANCE'
      AND sf.was_irs_conducted = true
      AND sf.months_since_irs IS NOT NULL
      AND sf.months_since_irs <= 12
  `;

  const result = await sequelize.query(query, {
    replacements: { siteIds, startDate, endDate },
    type: QueryTypes.SELECT,
  }) as Array<{ housesSprayed: number }>;

  return result[0]?.housesSprayed || 0;
}

async function loadFormHousesSprayedInLast12Months(
  siteIds: number[],
  startDate: Date,
  endDate: Date,
  programId: number,
  mappings: SurveillanceQuestionMappings
): Promise<number> {
  resetQuestionKeyParamCounter();
  const keyReplacements: Record<string, string> = {};
  const wasIrsExpr = buildBooleanExpression(
    mappings.wasIrsConducted!,
    'was_irs_conducted',
    keyReplacements
  );
  const monthsExpr = buildNumericExpression(
    mappings.monthsSinceIrs!,
    'months_since_irs',
    keyReplacements
  );

  const queryReplacements = {
    siteIds,
    startDate,
    endDate,
    programId,
    ...keyReplacements,
  };
  const joins = formAnswerJoins();

  const query = `
    SELECT COUNT(DISTINCT site_id) AS housesSprayed
    FROM (
      SELECT
        sess.site_id,
        ${wasIrsExpr},
        ${monthsExpr}
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      ${joins}
      WHERE s.id IN (:siteIds)
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sess.type = 'SURVEILLANCE'
      GROUP BY sess.site_id, sess.id
    ) AS per_session
    WHERE was_irs_conducted = 1
      AND months_since_irs IS NOT NULL
      AND months_since_irs <= 12
  `;

  const result = await sequelize.query(query, {
    replacements: queryReplacements,
    type: QueryTypes.SELECT,
  }) as Array<{ housesSprayed: number }>;

  return result[0]?.housesSprayed || 0;
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
      const parsedProgramIdForEmpty = query.programId ? Number(query.programId) : undefined;
      const metricsProgramIdForEmpty = parsedProgramIdForEmpty ?? (
        siteScope.programIds.length === 1 ? siteScope.programIds[0] : undefined
      );
      let emptyFormContext: Awaited<ReturnType<typeof resolveMetricsFormContext>> | undefined;
      if (metricsProgramIdForEmpty !== undefined) {
        emptyFormContext = await resolveMetricsFormContext(metricsProgramIdForEmpty);
      }
      return reply.send(emptyMetricsResponse({
        useFormMetrics: Boolean(emptyFormContext),
        mappings: emptyFormContext?.mappings,
      }));
    }

    const parsedProgramId = query.programId ? Number(query.programId) : undefined;
    const metricsProgramId = parsedProgramId ?? (
      siteScope.programIds.length === 1 ? siteScope.programIds[0] : undefined
    );

    let useFormMetrics = false;
    let formMetricsProgramId: number | undefined;
    let questionMappings: SurveillanceQuestionMappings | undefined;

    if (metricsProgramId !== undefined) {
      const formContext = await resolveMetricsFormContext(metricsProgramId);
      if (formContext) {
        useFormMetrics = true;
        formMetricsProgramId = formContext.programId;
        questionMappings = formContext.mappings;
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

    const householdMetrics = useFormMetrics && formMetricsProgramId && questionMappings
      ? await loadFormHouseholdMetrics(
        sessionSiteIds,
        startDate,
        endDate,
        formMetricsProgramId,
        questionMappings
      )
      : await loadLegacyHouseholdMetrics(sessionSiteIds, startDate, endDate);

    const hasLlinsMapping = useFormMetrics
      ? Boolean(questionMappings?.numLlinsAvailable)
      : true;
    const hasUnderLlinMapping = useFormMetrics
      ? Boolean(questionMappings?.numPeopleSleptUnderLlin)
      : true;

    const { totalLlins, totalPeopleSleptUnderLlin } = sumHouseholdRows(householdMetrics.rows);
    const resolvedTotalLlins = hasLlinsMapping ? totalLlins : null;
    const resolvedTotalPeopleSleptUnderLlin = hasUnderLlinMapping ? totalPeopleSleptUnderLlin : null;

    const hasIrsMapping = useFormMetrics
      ? hasIrsQuestionMappings(questionMappings)
      : true;
    const housesSprayedInLast12Months = hasIrsMapping
      ? (
        useFormMetrics && formMetricsProgramId && questionMappings
          ? await loadFormHousesSprayedInLast12Months(
            sessionSiteIds,
            startDate,
            endDate,
            formMetricsProgramId,
            questionMappings
          )
          : await loadLegacyHousesSprayedInLast12Months(sessionSiteIds, startDate, endDate)
      )
      : null;

    const {
      totalFedAnopheles,
      totalAnopheles,
      totalMosquitoes,
    } = await loadEntomologicalMetrics(sessionSiteIds, startDate, endDate);

    const peopleInAllHousesInspected = householdMetrics.peopleInAllHousesInspected;

    const llinsPerPerson = resolvedTotalLlins !== null && peopleInAllHousesInspected > 0
      ? Number((resolvedTotalLlins / peopleInAllHousesInspected).toFixed(2))
      : (resolvedTotalLlins === null ? null : 0);

    const fedAnophelesToPeopleSleptRatio = resolvedTotalPeopleSleptUnderLlin !== null
      && resolvedTotalPeopleSleptUnderLlin > 0
      ? Number((totalFedAnopheles / resolvedTotalPeopleSleptUnderLlin).toFixed(2))
      : (resolvedTotalPeopleSleptUnderLlin === null ? null : 0);

    const malariaVectorDensity = totalMosquitoes > 0
      ? totalAnopheles / totalMosquitoes
      : 0;

    return reply.send({
      siteInformation: {
        housesUsedForCollection,
        peopleInAllHousesInspected,
        housesSprayedInLast12Months,
      },
      entomologicalSummary: {
        totalFedAnopheles,
        malariaVectorDensity: Number(malariaVectorDensity.toFixed(2)),
        fedAnophelesToPeopleSleptRatio,
        totalLlins: resolvedTotalLlins,
        totalPeopleSleptUnderLlin: resolvedTotalPeopleSleptUnderLlin,
        llinsPerPerson,

        // for backward compatibility
        vectorDensity: Number(malariaVectorDensity.toFixed(2)),
        fedMosquitoesToPeopleSleptRatio: fedAnophelesToPeopleSleptRatio,
      },
      metricLabels: METRIC_LABELS,
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session metrics');
  }
}
