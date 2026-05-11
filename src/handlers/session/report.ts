import { FastifyReply, FastifyRequest } from 'fastify';
import { Op, QueryTypes } from 'sequelize';
import ExcelJS from 'exceljs';
import sequelize from '../../db';
import {
  Form,
  FormAnswer,
  FormQuestion,
  LocationType,
  Program,
  Session,
  Site,
  SurveillanceForm,
} from '../../db/models';
import { handleError } from './common';
import { buildSiteSubtreeWhere, expandSiteIdsWithDescendants } from '../site/common';

interface ReportQuery {
  startDate?: string;
  endDate?: string;
  sessionType?: 'SURVEILLANCE';
  programId?: string;
  districts?: string;
  siteIds?: string;
}

type HouseholdValueMap = Map<string, string>;

interface SpecimenCountRow {
  sessionId: number;
  siteId: number;
  monthKey: string | null;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
  count: number;
}

interface GroupAccumulator {
  monthKey: string;
  siteId: number;
  site: Site;
  householdFieldValues: Map<string, Set<string>>;
  firstCollectionDate: Date | null;
  lastSubmittedAt: Date | null;
  specimenGroupKey: string;
  hlcDiscrepancyGroupKey: string | null;
  sortDate: Date | null;
  sortId: number;
}

interface HeaderColorRanges {
  location: [number, number];
  session: [number, number];
  form: [number, number];
  specimen: [number, number];
}

interface WorkbookSheetSpec {
  name: string;
  rows: Array<Array<string | number>>;
  headerRanges?: HeaderColorRanges;
  highlightDiscrepancy?: boolean;
}

const DISCREPANCY_VALUE = 'DISCREPANCY';
const ALLOWED_HLC_DIFFERENCE_LABEL_PARTS = [
  'collection place',
  'collection time',
  'number of collectors',
  'wind',
  'rain',
  'relative humidity',
];

const SESSION_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'collectorName', label: 'Collector Name' },
  { key: 'collectorTitle', label: 'Collector Title' },
  { key: 'collectionMethod', label: 'Collection Method' },
  { key: 'specimenCondition', label: 'Specimen Condition' },
  { key: 'notes', label: 'Session Notes' },
];

const SURVEILLANCE_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'numPeopleSleptInHouse', label: 'Num People Slept In House' },
  { key: 'wasIrsConducted', label: 'Was IRS Conducted' },
  { key: 'monthsSinceIrs', label: 'Months Since IRS' },
  { key: 'numLlinsAvailable', label: 'Num LLINs Available' },
  { key: 'llinType', label: 'LLIN Type' },
  { key: 'llinBrand', label: 'LLIN Brand' },
  { key: 'numPeopleSleptUnderLlin', label: 'Num People Slept Under LLIN' },
];

export const schema = {
  tags: ['Sessions'],
  description: 'Export cleaned surveillance report as XLSX',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      sessionType: {
        type: 'string',
        enum: ['SURVEILLANCE'],
        description: 'Only SURVEILLANCE is supported',
      },
      programId: {
        type: 'number',
        description: 'Filter by program ID',
      },
      districts: {
        type: 'string',
        description: 'Comma-separated district names',
      },
      siteIds: {
        type: 'string',
        description: 'Comma-separated site IDs',
      },
    },
  },
  response: {
    200: { type: 'string' },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    403: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    500: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export interface ExportSessionReportRequest {
  Querystring: ReportQuery;
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

function toMonthKey(date: Date | null | undefined): string {
  if (!date) return 'NO_DATE';
  return date.toISOString().slice(0, 7);
}

function monthKeyToDate(monthKey: string): Date | null {
  if (monthKey === 'NO_DATE') return null;
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatTimestamp(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toISOString().replace('T', ' ').slice(0, 19);
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeFormAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function hasLegacyLocationDetails(site: Site): boolean {
  const values = [
    site.district,
    site.subCounty,
    site.parish,
    site.villageName,
    site.houseNumber,
  ];
  return values.some((value) => typeof value === 'string' && value.trim().length > 0);
}

function getLocationHierarchyMap(site: Site): Record<string, string> {
  const rawHierarchy = site.locationHierarchy;
  if (!rawHierarchy || typeof rawHierarchy !== 'object' || Array.isArray(rawHierarchy)) return {};

  const hierarchy = (rawHierarchy as any).hierarchy;
  if (!Array.isArray(hierarchy)) return {};

  return hierarchy.reduce<Record<string, string>>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const locationType = (entry as any).locationType;
    const value = (entry as any).value;
    if (typeof locationType === 'string' && typeof value === 'string' && locationType && value) {
      acc[locationType] = value;
    }
    return acc;
  }, {});
}

function createSpecimenColumnName(
  species: string | null,
  sex: string | null,
  abdomenStatus: string | null
): string {
  const parts = [species, sex, abdomenStatus].filter(
    (part) => part !== null && part !== '' && part.toLowerCase() !== 'unknown'
  );
  const columnName = parts.join(' ').trim();
  return columnName.length > 0 ? columnName : 'Unclassified';
}

function resolveDiscrepancy(values: Set<string>): string {
  if (values.size === 0) return '';
  if (values.size === 1) return values.values().next().value as string;
  return DISCREPANCY_VALUE;
}

function getReportGroupKey(monthKey: string, siteId: number): string {
  return `${monthKey}|${siteId}`;
}

function getHlcReportGroupKey(monthKey: string, siteId: number, sessionId: number): string {
  return `${getReportGroupKey(monthKey, siteId)}|session:${sessionId}`;
}

function isHlcHouse(site: Site): boolean {
  const possibleHouseNames = [site.name, site.houseNumber];
  return possibleHouseNames.some((value) => normalizeValue(value).toUpperCase().includes('HLC'));
}

function isAllowedHlcDifferenceColumn(column: string): boolean {
  const normalizedColumn = column.toLowerCase();
  return ALLOWED_HLC_DIFFERENCE_LABEL_PARTS.some((labelPart) => normalizedColumn.includes(labelPart));
}

function getPeriodLabel(
  monthKey: string,
  hasMultipleMonths: boolean,
  startDate?: Date,
  endDate?: Date
): string {
  if (!hasMultipleMonths) {
    if (startDate && endDate) {
      return `${formatDate(startDate)} to ${formatDate(endDate)}`;
    }
    return 'All Dates';
  }

  if (monthKey === 'NO_DATE') {
    return 'No Collection Date';
  }

  const monthStart = monthKeyToDate(monthKey);
  if (!monthStart) return monthKey;

  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const boundedStart = startDate && startDate > monthStart ? startDate : monthStart;
  const boundedEnd = endDate && endDate < monthEnd ? endDate : monthEnd;
  return `${formatDate(boundedStart)} to ${formatDate(boundedEnd)}`;
}

export async function exportSessionReport(
  request: FastifyRequest<ExportSessionReportRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, sessionType, programId, districts, siteIds } = request.query;

    if (sessionType && sessionType !== 'SURVEILLANCE') {
      return reply.code(400).send({ error: 'Only SURVEILLANCE sessionType is supported' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    const parsedProgramId = programId ? Number(programId) : undefined;
    if (programId && (parsedProgramId === undefined || !Number.isInteger(parsedProgramId) || parsedProgramId <= 0)) {
      return reply.code(400).send({ error: 'programId must be a positive integer' });
    }

    const siteAccess = request.siteAccess;
    if (!siteAccess?.canRead) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to read site data' });
    }

    const requestedDistricts = parseCommaSeparated(districts);
    const requestedSiteIds = parseSiteIds(siteIds);
    const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);

    const siteWhere: any = {};
    if (requestedDistricts.length > 0) {
      siteWhere.district = { [Op.in]: requestedDistricts };
    }
    if (parsedProgramId !== undefined) {
      siteWhere.programId = parsedProgramId;
    }

    if (accessibleSiteIds.length > 0) {
      siteWhere.id = { [Op.in]: accessibleSiteIds };
    }

    if (requestedSiteIds.length > 0) {
      const subtreeWhere = buildSiteSubtreeWhere(requestedSiteIds);
      if (subtreeWhere) {
        siteWhere[Op.and] = [
          ...(siteWhere[Op.and] ?? []),
          subtreeWhere,
        ];
      }
    }

    const filteredSites = await Site.findAll({
      where: siteWhere,
      order: [['id', 'ASC']],
    });

    if (filteredSites.length === 0) {
      return await sendWorkbook(reply, [
        {
          name: 'Report',
          rows: [['No report data found for provided filters.']],
        },
        {
          name: 'Missing Data',
          rows: [['No matching sites found for provided filters.']],
        },
      ]);
    }

    const filteredSiteIds = filteredSites.map((site) => site.id);
    const childSiteRows = await Site.findAll({
      where: { parentId: { [Op.in]: filteredSiteIds } },
      attributes: ['parentId'],
      raw: true,
    }) as Array<{ parentId: number | null }>;
    const parentIdsWithChildren = new Set(
      childSiteRows
        .map((row) => row.parentId)
        .filter((parentId): parentId is number => typeof parentId === 'number')
    );
    const leafSites = filteredSites.filter((site) => !parentIdsWithChildren.has(site.id));

    if (leafSites.length === 0) {
      return await sendWorkbook(reply, [
        {
          name: 'Report',
          rows: [['No report data found for provided filters.']],
        },
        {
          name: 'Missing Data',
          rows: [['No leaf sites found for provided filters.']],
        },
      ]);
    }

    const leafSiteIds = leafSites.map((site) => site.id);
    const includeLegacyLocationColumns = leafSites.some((site) => hasLegacyLocationDetails(site));

    const sessionWhere: any = {
      type: 'SURVEILLANCE',
      siteId: { [Op.in]: leafSiteIds },
    };

    if (startDate || endDate) {
      sessionWhere.collectionDate = {};
      if (startDate) {
        sessionWhere.collectionDate[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        sessionWhere.collectionDate[Op.lt] = endExclusive;
      }
    }

    const sessions = await Session.findAll({
      where: sessionWhere,
      include: [
        {
          model: Site,
          as: 'site',
          include: [
            {
              model: Program,
              as: 'program',
              attributes: ['id', 'name', 'country', 'formVersion'],
            },
          ],
        },
        {
          model: SurveillanceForm,
          as: 'surveillanceForm',
          required: false,
        },
      ],
      order: [['collectionDate', 'ASC'], ['id', 'ASC']],
    });

    const sessionIds = sessions.map((session) => session.id);
    const involvedProgramIds = Array.from(
      new Set(leafSites.map((site) => site.programId))
    );

    const locationTypes = involvedProgramIds.length > 0
      ? await LocationType.findAll({
        where: { programId: { [Op.in]: involvedProgramIds } },
        attributes: ['programId', 'name', 'level'],
        order: [['programId', 'ASC'], ['level', 'ASC'], ['id', 'ASC']],
      })
      : [];

    const locationHierarchyColumns: string[] = [];
    const seenLocationColumns = new Set<string>();
    for (const locationType of locationTypes) {
      if (!seenLocationColumns.has(locationType.name)) {
        locationHierarchyColumns.push(locationType.name);
        seenLocationColumns.add(locationType.name);
      }
    }

    for (const site of leafSites) {
      const hierarchy = getLocationHierarchyMap(site);
      Object.keys(hierarchy).forEach((key) => {
        if (!seenLocationColumns.has(key)) {
          locationHierarchyColumns.push(key);
          seenLocationColumns.add(key);
        }
      });
    }

    const programVersionMap = new Map<number, string>();
    for (const session of sessions) {
      const site = session.get('site') as Site | undefined;
      const program = site?.get('program') as Program | undefined;
      if (program?.formVersion) {
        programVersionMap.set(program.id, program.formVersion);
      }
    }

    const forms = involvedProgramIds.length > 0
      ? await Form.findAll({
        where: {
          programId: { [Op.in]: involvedProgramIds },
          version: { [Op.ne]: '' },
        },
        attributes: ['id', 'programId', 'version'],
        order: [['programId', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      })
      : [];

    const formIdByProgram = new Map<number, number>();
    const latestFormIdByProgram = new Map<number, number>();
    for (const form of forms) {
      if (!latestFormIdByProgram.has(form.programId)) {
        latestFormIdByProgram.set(form.programId, form.id);
      }
    }

    for (const form of forms) {
      const targetVersion = programVersionMap.get(form.programId);
      if (targetVersion && form.version === targetVersion) {
        formIdByProgram.set(form.programId, form.id);
      }
    }

    // If a program has no selected version, fall back to the latest published form.
    for (const programId of involvedProgramIds) {
      if (formIdByProgram.has(programId)) continue;
      const latestFormId = latestFormIdByProgram.get(programId);
      if (latestFormId) {
        formIdByProgram.set(programId, latestFormId);
      }
    }

    const selectedFormIds = Array.from(new Set(formIdByProgram.values()));
    const formQuestions = selectedFormIds.length > 0
      ? await FormQuestion.findAll({
        where: { formId: { [Op.in]: selectedFormIds } },
        attributes: ['id', 'formId', 'label', 'order'],
        order: [['formId', 'ASC'], ['order', 'ASC'], ['id', 'ASC']],
      })
      : [];

    const questionById = new Map<number, FormQuestion>();
    const dynamicQuestionLabels: string[] = [];
    const seenDynamicLabels = new Set<string>();
    for (const question of formQuestions) {
      questionById.set(question.id, question);
      if (!seenDynamicLabels.has(question.label)) {
        dynamicQuestionLabels.push(question.label);
        seenDynamicLabels.add(question.label);
      }
    }

    const rawAnswers = selectedFormIds.length > 0
      ? await FormAnswer.findAll({
        where: {
          sessionId: { [Op.in]: sessionIds },
          formId: { [Op.in]: selectedFormIds },
        },
        attributes: ['sessionId', 'formId', 'questionId', 'value'],
      })
      : [];

    const answerMapBySession = new Map<number, HouseholdValueMap>();
    for (const answer of rawAnswers) {
      const question = questionById.get(answer.questionId);
      if (!question) continue;

      let values = answerMapBySession.get(answer.sessionId);
      if (!values) {
        values = new Map<string, string>();
        answerMapBySession.set(answer.sessionId, values);
      }

      values.set(question.label, normalizeFormAnswerValue(answer.value));
    }

    const specimenCountRows = await getSpecimenCountsBySession(sessionIds);
    const specimenColumns = new Set<string>();
    const specimenCountByReportGroup = new Map<string, Map<string, number>>();
    for (const row of specimenCountRows) {
      const monthKey = row.monthKey ?? 'NO_DATE';
      const columnName = createSpecimenColumnName(row.species, row.sex, row.abdomenStatus);
      specimenColumns.add(columnName);

      const reportGroupKeys = [
        getReportGroupKey(monthKey, row.siteId),
        getHlcReportGroupKey(monthKey, row.siteId, row.sessionId),
      ];

      for (const groupKey of reportGroupKeys) {
        if (!specimenCountByReportGroup.has(groupKey)) {
          specimenCountByReportGroup.set(groupKey, new Map<string, number>());
        }
        const groupCounts = specimenCountByReportGroup.get(groupKey)!;
        groupCounts.set(columnName, (groupCounts.get(columnName) ?? 0) + Number(row.count));
      }
    }

    const sessionColumns = SESSION_FIELD_LABELS.map((item) => item.label);
    const includeSurveillanceColumns = sessions.some((session) => {
      const site = session.get('site') as Site | undefined;
      const program = site?.get('program') as Program | undefined;
      if (!program) return true;
      return !formIdByProgram.has(program.id);
    });
    const formColumns = Array.from(
      new Set([
        ...(includeSurveillanceColumns ? SURVEILLANCE_FIELD_LABELS.map((item) => item.label) : []),
        ...dynamicQuestionLabels,
      ])
    );
    const householdColumns = [...sessionColumns, ...formColumns];

    const finalSpecimenColumns = Array.from(specimenColumns).sort((a, b) => a.localeCompare(b));

    const groupedByMonthAndSite = new Map<string, GroupAccumulator>();
    const hlcComparisonValuesByHouseMonth = new Map<string, Map<string, Set<string>>>();
    for (const session of sessions) {
      const monthKey = toMonthKey(session.collectionDate);
      const site = session.get('site') as Site;
      const houseMonthGroupKey = getReportGroupKey(monthKey, site.id);
      const isHlc = isHlcHouse(site);
      const reportGroupKey = isHlc
        ? getHlcReportGroupKey(monthKey, site.id, session.id)
        : houseMonthGroupKey;

      if (!groupedByMonthAndSite.has(reportGroupKey)) {
        groupedByMonthAndSite.set(reportGroupKey, {
          monthKey,
          siteId: site.id,
          site,
          householdFieldValues: new Map<string, Set<string>>(),
          firstCollectionDate: null,
          lastSubmittedAt: null,
          specimenGroupKey: reportGroupKey,
          hlcDiscrepancyGroupKey: isHlc ? houseMonthGroupKey : null,
          sortDate: session.collectionDate,
          sortId: session.id,
        });
      }

      const group = groupedByMonthAndSite.get(reportGroupKey)!;

      if (session.collectionDate) {
        if (!group.firstCollectionDate || session.collectionDate < group.firstCollectionDate) {
          group.firstCollectionDate = session.collectionDate;
        }
      }
      if (session.submittedAt) {
        if (!group.lastSubmittedAt || session.submittedAt > group.lastSubmittedAt) {
          group.lastSubmittedAt = session.submittedAt;
        }
      }

      const householdValues = extractHouseholdValuesForSession(
        session,
        formIdByProgram,
        answerMapBySession
      );

      for (const column of householdColumns) {
        const value = householdValues.get(column) ?? '';
        if (!group.householdFieldValues.has(column)) {
          group.householdFieldValues.set(column, new Set<string>());
        }
        group.householdFieldValues.get(column)!.add(value);

        if (isHlc) {
          if (!hlcComparisonValuesByHouseMonth.has(houseMonthGroupKey)) {
            hlcComparisonValuesByHouseMonth.set(houseMonthGroupKey, new Map<string, Set<string>>());
          }
          const houseMonthValues = hlcComparisonValuesByHouseMonth.get(houseMonthGroupKey)!;
          if (!houseMonthValues.has(column)) {
            houseMonthValues.set(column, new Set<string>());
          }
          houseMonthValues.get(column)!.add(value);
        }
      }
    }

    const hlcDiscrepancyColumnsByHouseMonth = new Map<string, Set<string>>();
    for (const [houseMonthGroupKey, valuesByColumn] of hlcComparisonValuesByHouseMonth.entries()) {
      const discrepantColumns = new Set<string>();
      for (const [column, values] of valuesByColumn.entries()) {
        if (!isAllowedHlcDifferenceColumn(column) && resolveDiscrepancy(values) === DISCREPANCY_VALUE) {
          discrepantColumns.add(column);
        }
      }
      hlcDiscrepancyColumnsByHouseMonth.set(houseMonthGroupKey, discrepantColumns);
    }

    const orderedGroups = Array.from(groupedByMonthAndSite.values()).sort((a, b) => {
      if (a.monthKey === b.monthKey) {
        if (a.siteId !== b.siteId) return a.siteId - b.siteId;
        const aTime = a.sortDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.sortDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return a.sortId - b.sortId;
      }
      if (a.monthKey === 'NO_DATE') return 1;
      if (b.monthKey === 'NO_DATE') return -1;
      return a.monthKey.localeCompare(b.monthKey);
    });

    const uniqueMonthKeys = Array.from(new Set(orderedGroups.map((group) => group.monthKey)));
    const hasMultipleMonths = uniqueMonthKeys.filter((key) => key !== 'NO_DATE').length > 1;
    const startDateObj = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
    const endDateObj = endDate ? new Date(`${endDate}T00:00:00.000Z`) : undefined;

    const headerRow = [
      'Site ID',
      ...locationHierarchyColumns,
      ...(includeLegacyLocationColumns
        ? ['District', 'Sub County', 'Parish', 'Village Name', 'House Number']
        : []),
      'Collection Date',
      'Submitted At',
      ...householdColumns,
      ...finalSpecimenColumns,
      'Total Specimens',
    ];

    const reportRows: Array<Array<string | number>> = [];
    for (const monthKey of uniqueMonthKeys) {
      const periodLabel = getPeriodLabel(monthKey, hasMultipleMonths, startDateObj, endDateObj);
      reportRows.push([`Period: ${periodLabel}`]);
      reportRows.push(headerRow);

      const monthRows = orderedGroups.filter((group) => group.monthKey === monthKey);
      for (const group of monthRows) {
        const site = group.site;
        const hierarchy = getLocationHierarchyMap(site);
        const row: Array<string | number> = [group.siteId];

        for (const hierarchyKey of locationHierarchyColumns) {
          row.push(normalizeValue(hierarchy[hierarchyKey] ?? ''));
        }

        if (includeLegacyLocationColumns) {
          row.push(
            normalizeValue(site.district),
            normalizeValue(site.subCounty),
            normalizeValue(site.parish),
            normalizeValue(site.villageName),
            normalizeValue(site.houseNumber)
          );
        }

        row.push(
          formatTimestamp(group.firstCollectionDate),
          formatTimestamp(group.lastSubmittedAt)
        );

        for (const householdColumn of householdColumns) {
          const values = group.householdFieldValues.get(householdColumn) ?? new Set<string>();
          const hlcDiscrepancies = group.hlcDiscrepancyGroupKey
            ? hlcDiscrepancyColumnsByHouseMonth.get(group.hlcDiscrepancyGroupKey)
            : undefined;
          row.push(hlcDiscrepancies?.has(householdColumn) ? DISCREPANCY_VALUE : resolveDiscrepancy(values));
        }

        const specimenCounts = specimenCountByReportGroup.get(group.specimenGroupKey) ?? new Map<string, number>();
        let totalSpecimens = 0;

        for (const specimenColumn of finalSpecimenColumns) {
          const count = specimenCounts.get(specimenColumn) ?? 0;
          totalSpecimens += count;
          row.push(count);
        }

        row.push(totalSpecimens);
        reportRows.push(row);
      }

      reportRows.push([]);
    }

    if (reportRows.length === 0) {
      reportRows.push(['No report data found for provided filters.']);
    }

    const expectedBySiteMonth = new Map<string, number>();
    const sessionCountBySiteMonth = new Map<string, number>();
    const eligibleSessionCountBySiteMonth = new Map<string, number>();
    const eligibleSessionIds = new Set<number>();
    for (const session of sessions) {
      const monthKey = toMonthKey(session.collectionDate);
      const siteMonthKey = `${monthKey}|${session.siteId}`;
      sessionCountBySiteMonth.set(
        siteMonthKey,
        (sessionCountBySiteMonth.get(siteMonthKey) ?? 0) + 1
      );

      const expectedSpecimens = session.expectedSpecimens ?? 0;
      // Sessions with no expected specimens are treated as matched and excluded from mismatch math.
      if (expectedSpecimens <= 0) {
        continue;
      }

      eligibleSessionIds.add(session.id);
      expectedBySiteMonth.set(
        siteMonthKey,
        (expectedBySiteMonth.get(siteMonthKey) ?? 0) + expectedSpecimens
      );
      eligibleSessionCountBySiteMonth.set(
        siteMonthKey,
        (eligibleSessionCountBySiteMonth.get(siteMonthKey) ?? 0) + 1
      );
    }

    const actualBySession = await getSpecimenTotalsBySession(Array.from(eligibleSessionIds));
    const actualBySiteMonth = new Map<string, number>();
    for (const session of sessions) {
      if (!eligibleSessionIds.has(session.id)) {
        continue;
      }
      const monthKey = toMonthKey(session.collectionDate);
      const siteMonthKey = `${monthKey}|${session.siteId}`;
      const sessionActual = actualBySession.get(session.id) ?? 0;
      actualBySiteMonth.set(
        siteMonthKey,
        (actualBySiteMonth.get(siteMonthKey) ?? 0) + sessionActual
      );
    }

    const missingHeaderRow = [
      'Site ID',
      ...locationHierarchyColumns,
      ...(includeLegacyLocationColumns
        ? ['District', 'Sub County', 'Parish', 'Village Name', 'House Number']
        : []),
      'Actual Specimens',
      'Expected Specimens',
      'Comments',
    ];
    const missingRows: Array<Array<string | number>> = [];
    const missingMonthKeys = uniqueMonthKeys.length > 0 ? uniqueMonthKeys : ['NO_DATE'];

    for (const monthKey of missingMonthKeys) {
      const periodLabel = getPeriodLabel(monthKey, hasMultipleMonths, startDateObj, endDateObj);
      missingRows.push([`Period: ${periodLabel}`]);
      missingRows.push(missingHeaderRow);

      let periodHasRows = false;
      const periodRows: Array<{
        row: Array<string | number>;
        siteId: number;
        noSessions: boolean;
      }> = [];
      for (const site of leafSites) {
        const siteMonthKey = `${monthKey}|${site.id}`;
        const siteHasSessions = (sessionCountBySiteMonth.get(siteMonthKey) ?? 0) > 0;
        const hasEligibleSessions = (eligibleSessionCountBySiteMonth.get(siteMonthKey) ?? 0) > 0;
        const actual = actualBySiteMonth.get(siteMonthKey) ?? 0;
        const expected = expectedBySiteMonth.get(siteMonthKey) ?? 0;
        const mismatch = hasEligibleSessions && actual !== expected;
        const noSessions = !siteHasSessions;

        if (!mismatch && !noSessions) {
          continue;
        }

        const hierarchy = getLocationHierarchyMap(site);
        const missingRow: Array<string | number> = [site.id];
        for (const hierarchyKey of locationHierarchyColumns) {
          missingRow.push(normalizeValue(hierarchy[hierarchyKey] ?? ''));
        }

        if (includeLegacyLocationColumns) {
          missingRow.push(
            normalizeValue(site.district),
            normalizeValue(site.subCounty),
            normalizeValue(site.parish),
            normalizeValue(site.villageName),
            normalizeValue(site.houseNumber)
          );
        }

        if (noSessions) {
          missingRow.push('N.A.', 'N.A.', 'No sessions were conducted for this site');
        } else {
          missingRow.push(actual, expected, '');
        }

        periodRows.push({
          row: missingRow,
          siteId: site.id,
          noSessions,
        });
        periodHasRows = true;
      }

      if (!periodHasRows) {
        missingRows.push(['No missing data rows for this period.']);
      } else {
        periodRows.sort((a, b) => {
          if (a.noSessions !== b.noSessions) {
            return a.noSessions ? 1 : -1;
          }
          return a.siteId - b.siteId;
        });
        for (const item of periodRows) {
          missingRows.push(item.row);
        }
      }
      missingRows.push([]);
    }

    const firstLocationColumn = 1;
    const locationDetailColumnCount = includeLegacyLocationColumns ? 5 : 0;
    const timestampColumnCount = 2;
    const lastLocationColumn = 1 + locationHierarchyColumns.length + locationDetailColumnCount + timestampColumnCount;
    const firstSessionColumn = lastLocationColumn + 1;
    const lastSessionColumn = firstSessionColumn + sessionColumns.length - 1;
    const firstFormColumn = lastSessionColumn + 1;
    const lastFormColumn = firstFormColumn + formColumns.length - 1;
    const firstSpecimenColumn = lastFormColumn + 1;
    const lastSpecimenColumn = firstSpecimenColumn + finalSpecimenColumns.length;
    const missingFirstLocationColumn = 1;
    const missingLastLocationColumn = 1 + locationHierarchyColumns.length + locationDetailColumnCount;
    const missingFirstSpecimenColumn = missingLastLocationColumn + 1;
    const missingLastSpecimenColumn = missingFirstSpecimenColumn + 2;

    return await sendWorkbook(reply, [
      {
        name: 'Report',
        rows: reportRows,
        headerRanges: {
          location: [firstLocationColumn, lastLocationColumn],
          session: [firstSessionColumn, lastSessionColumn],
          form: [firstFormColumn, lastFormColumn],
          specimen: [firstSpecimenColumn, lastSpecimenColumn],
        },
        highlightDiscrepancy: true,
      },
      {
        name: 'Missing Data',
        rows: missingRows,
        headerRanges: {
          location: [missingFirstLocationColumn, missingLastLocationColumn],
          session: [0, -1],
          form: [0, -1],
          specimen: [missingFirstSpecimenColumn, missingLastSpecimenColumn],
        },
      },
    ]);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export report');
  }
}

async function getSpecimenCountsBySession(sessionIds: number[]): Promise<SpecimenCountRow[]> {
  if (sessionIds.length === 0) return [];

  const query = `
    SELECT
      sess.id AS sessionId,
      s.id AS siteId,
      DATE_FORMAT(sess.collection_date, '%Y-%m') AS monthKey,
      si.species AS species,
      si.sex AS sex,
      si.abdomen_status AS abdomenStatus,
      COUNT(sp.id) AS count
    FROM specimens sp
    INNER JOIN sessions sess ON sp.session_id = sess.id
    INNER JOIN sites s ON sess.site_id = s.id
    LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
    WHERE sess.id IN (:sessionIds)
    GROUP BY
      sess.id,
      s.id,
      DATE_FORMAT(sess.collection_date, '%Y-%m'),
      si.species,
      si.sex,
      si.abdomen_status
  `;

  const rows = await sequelize.query(query, {
    replacements: { sessionIds },
    type: QueryTypes.SELECT,
  }) as SpecimenCountRow[];

  return rows;
}

async function getSpecimenTotalsBySession(sessionIds: number[]): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  if (sessionIds.length === 0) return totals;

  const query = `
    SELECT
      sp.session_id AS sessionId,
      COUNT(sp.id) AS actualSpecimens
    FROM specimens sp
    WHERE sp.session_id IN (:sessionIds)
    GROUP BY sp.session_id
  `;

  const rows = await sequelize.query(query, {
    replacements: { sessionIds },
    type: QueryTypes.SELECT,
  }) as Array<{ sessionId: number; actualSpecimens: number }>;

  for (const row of rows) {
    totals.set(Number(row.sessionId), Number(row.actualSpecimens));
  }

  return totals;
}

function extractHouseholdValuesForSession(
  session: Session,
  formIdByProgram: Map<number, number>,
  answerMapBySession: Map<number, HouseholdValueMap>
): HouseholdValueMap {
  const values = new Map<string, string>();

  for (const field of SESSION_FIELD_LABELS) {
    const sessionValue = (session as any)[field.key];
    values.set(field.label, normalizeValue(sessionValue));
  }

  const site = session.get('site') as Site | undefined;
  const program = site?.get('program') as Program | undefined;
  const selectedFormId = program ? formIdByProgram.get(program.id) : undefined;

  if (selectedFormId) {
    const answerValues = answerMapBySession.get(session.id) ?? new Map<string, string>();
    for (const [label, value] of answerValues.entries()) {
      values.set(label, normalizeValue(value));
    }
    return values;
  }

  const surveillanceForm = session.get('surveillanceForm') as SurveillanceForm | undefined;
  for (const field of SURVEILLANCE_FIELD_LABELS) {
    const formValue = surveillanceForm ? (surveillanceForm as any)[field.key] : '';
    values.set(field.label, normalizeValue(formValue));
  }
  return values;
}

async function sendWorkbook(
  reply: FastifyReply,
  sheets: WorkbookSheetSpec[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  for (const sheetSpec of sheets) {
    const worksheet = workbook.addWorksheet(sheetSpec.name);
    for (const row of sheetSpec.rows) {
      worksheet.addRow(row);
    }

    if (sheetSpec.headerRanges) {
      styleReportHeaders(worksheet, sheetSpec.headerRanges);
    } else {
      styleSimpleHeaderRow(worksheet);
    }

    if (sheetSpec.highlightDiscrepancy) {
      styleDiscrepancyCells(worksheet);
    }

    worksheet.columns.forEach((column) => {
      if (!column || typeof column.eachCell !== 'function') {
        return;
      }
      let max = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value === null || cell.value === undefined ? '' : String(cell.value);
        max = Math.max(max, Math.min(40, value.length + 2));
      });
      column.width = max;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  reply.header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  reply.header('Content-Disposition', 'attachment; filename=session-report.xlsx');
  reply.send(buffer);
}

function styleSimpleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow((row) => {
    const firstCell = row.getCell(1);
    const firstValue = firstCell.value === null || firstCell.value === undefined ? '' : String(firstCell.value);
    if (firstValue !== 'Site ID') return;

    row.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      };
    });
  });
}

function styleReportHeaders(
  worksheet: ExcelJS.Worksheet,
  headerRanges: HeaderColorRanges
): void {
  const palette = {
    location: 'FFD9EAF7',
    session: 'FFFCE5CD',
    form: 'FFE2F0D9',
    specimen: 'FFE4DFEC',
  };

  worksheet.eachRow((row) => {
    const firstCell = row.getCell(1);
    const firstValue = firstCell.value === null || firstCell.value === undefined
      ? ''
      : String(firstCell.value);

    if (firstValue.startsWith('Period:')) {
      firstCell.font = { bold: true };
      return;
    }

    if (firstValue !== 'Site ID') {
      return;
    }

    applyHeaderRangeStyle(row, headerRanges.location, palette.location);
    applyHeaderRangeStyle(row, headerRanges.session, palette.session);
    applyHeaderRangeStyle(row, headerRanges.form, palette.form);
    applyHeaderRangeStyle(row, headerRanges.specimen, palette.specimen);
  });
}

function styleDiscrepancyCells(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === null || cell.value === undefined) return;
      const text = String(cell.value).trim().toUpperCase();
      if (text !== DISCREPANCY_VALUE && text !== 'DISCREPANCT') return;

      cell.font = { bold: true, color: { argb: 'FF9C0006' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      };
    });
  });
}

function applyHeaderRangeStyle(
  row: ExcelJS.Row,
  [startCol, endCol]: [number, number],
  argb: string
): void {
  if (endCol < startCol) return;

  for (let col = startCol; col <= endCol; col += 1) {
    const cell = row.getCell(col);
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  }
}
