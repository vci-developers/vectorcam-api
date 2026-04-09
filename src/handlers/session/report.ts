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
}

interface HeaderColorRanges {
  location: [number, number];
  session: [number, number];
  form: [number, number];
  specimen: [number, number];
}

const DISCREPANCY_VALUE = 'DISCREPANCY';

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
    const accessibleSiteIds = siteAccess.userSites.length > 0 ? siteAccess.userSites : null;

    let filteredSiteIds = requestedSiteIds;
    if (accessibleSiteIds) {
      filteredSiteIds = filteredSiteIds.length > 0
        ? filteredSiteIds.filter((id) => accessibleSiteIds.includes(id))
        : accessibleSiteIds;
    }

    if (requestedSiteIds.length > 0 && filteredSiteIds.length === 0) {
      return await sendWorkbook(reply, [['No matching sites found for provided filters.']]);
    }

    const sessionWhere: any = {
      type: 'SURVEILLANCE',
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

    if (filteredSiteIds.length > 0) {
      sessionWhere.siteId = { [Op.in]: filteredSiteIds };
    }

    const siteWhere: any = {};
    if (requestedDistricts.length > 0) {
      siteWhere.district = { [Op.in]: requestedDistricts };
    }
    if (parsedProgramId !== undefined) {
      siteWhere.programId = parsedProgramId;
    }

    const sessions = await Session.findAll({
      where: sessionWhere,
      include: [
        {
          model: Site,
          as: 'site',
          where: Object.keys(siteWhere).length ? siteWhere : undefined,
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

    if (sessions.length === 0) {
      return await sendWorkbook(reply, [['No report data found for provided filters.']]);
    }

    const sessionIds = sessions.map((session) => session.id);
    const involvedProgramIds = Array.from(
      new Set(
        sessions
          .map((session) => (session.get('site') as Site | undefined)?.programId)
          .filter((programId): programId is number => typeof programId === 'number')
      )
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

    for (const session of sessions) {
      const site = session.get('site') as Site | undefined;
      const hierarchy = site?.locationHierarchy ?? {};
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
      })
      : [];

    const formIdByProgram = new Map<number, number>();
    for (const form of forms) {
      const targetVersion = programVersionMap.get(form.programId);
      if (targetVersion && form.version === targetVersion) {
        formIdByProgram.set(form.programId, form.id);
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

    const specimenCountRows = await getSpecimenCountsByMonthSite(sessionIds);
    const specimenColumns = new Set<string>();
    const specimenCountByGroup = new Map<string, Map<string, number>>();
    for (const row of specimenCountRows) {
      const monthKey = row.monthKey ?? 'NO_DATE';
      const groupKey = `${monthKey}|${row.siteId}`;
      const columnName = createSpecimenColumnName(row.species, row.sex, row.abdomenStatus);
      specimenColumns.add(columnName);

      if (!specimenCountByGroup.has(groupKey)) {
        specimenCountByGroup.set(groupKey, new Map<string, number>());
      }
      const groupCounts = specimenCountByGroup.get(groupKey)!;
      groupCounts.set(columnName, (groupCounts.get(columnName) ?? 0) + Number(row.count));
    }

    const sessionColumns = SESSION_FIELD_LABELS.map((item) => item.label);
    const formColumns = Array.from(
      new Set([
        ...SURVEILLANCE_FIELD_LABELS.map((item) => item.label),
        ...dynamicQuestionLabels,
      ])
    );
    const householdColumns = [...sessionColumns, ...formColumns];

    const finalSpecimenColumns = Array.from(specimenColumns).sort((a, b) => a.localeCompare(b));

    const groupedByMonthAndSite = new Map<string, GroupAccumulator>();
    for (const session of sessions) {
      const monthKey = toMonthKey(session.collectionDate);
      const site = session.get('site') as Site;
      const groupKey = `${monthKey}|${site.id}`;

      if (!groupedByMonthAndSite.has(groupKey)) {
        groupedByMonthAndSite.set(groupKey, {
          monthKey,
          siteId: site.id,
          site,
          householdFieldValues: new Map<string, Set<string>>(),
        });
      }

      const group = groupedByMonthAndSite.get(groupKey)!;
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
      }
    }

    const orderedGroups = Array.from(groupedByMonthAndSite.values()).sort((a, b) => {
      if (a.monthKey === b.monthKey) return a.siteId - b.siteId;
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
      'District',
      'Sub County',
      'Parish',
      'Village Name',
      'House Number',
      ...householdColumns,
      ...finalSpecimenColumns,
      'Total Specimens',
    ];

    const rows: Array<Array<string | number>> = [];
    for (const monthKey of uniqueMonthKeys) {
      const periodLabel = getPeriodLabel(monthKey, hasMultipleMonths, startDateObj, endDateObj);
      rows.push([`Period: ${periodLabel}`]);
      rows.push(headerRow);

      const monthRows = orderedGroups.filter((group) => group.monthKey === monthKey);
      for (const group of monthRows) {
        const site = group.site;
        const hierarchy = site.locationHierarchy ?? {};
        const row: Array<string | number> = [group.siteId];

        for (const hierarchyKey of locationHierarchyColumns) {
          row.push(normalizeValue(hierarchy[hierarchyKey] ?? ''));
        }

        row.push(
          normalizeValue(site.district),
          normalizeValue(site.subCounty),
          normalizeValue(site.parish),
          normalizeValue(site.villageName),
          normalizeValue(site.houseNumber)
        );

        for (const householdColumn of householdColumns) {
          const values = group.householdFieldValues.get(householdColumn) ?? new Set<string>();
          row.push(resolveDiscrepancy(values));
        }

        const groupKey = `${group.monthKey}|${group.siteId}`;
        const specimenCounts = specimenCountByGroup.get(groupKey) ?? new Map<string, number>();
        let totalSpecimens = 0;

        for (const specimenColumn of finalSpecimenColumns) {
          const count = specimenCounts.get(specimenColumn) ?? 0;
          totalSpecimens += count;
          row.push(count);
        }

        row.push(totalSpecimens);
        rows.push(row);
      }

      rows.push([]);
    }

    const firstLocationColumn = 1;
    const lastLocationColumn = 1 + locationHierarchyColumns.length + 5;
    const firstSessionColumn = lastLocationColumn + 1;
    const lastSessionColumn = firstSessionColumn + sessionColumns.length - 1;
    const firstFormColumn = lastSessionColumn + 1;
    const lastFormColumn = firstFormColumn + formColumns.length - 1;
    const firstSpecimenColumn = lastFormColumn + 1;
    const lastSpecimenColumn = firstSpecimenColumn + finalSpecimenColumns.length;

    return await sendWorkbook(reply, rows, {
      location: [firstLocationColumn, lastLocationColumn],
      session: [firstSessionColumn, lastSessionColumn],
      form: [firstFormColumn, lastFormColumn],
      specimen: [firstSpecimenColumn, lastSpecimenColumn],
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export report');
  }
}

async function getSpecimenCountsByMonthSite(sessionIds: number[]): Promise<SpecimenCountRow[]> {
  if (sessionIds.length === 0) return [];

  const query = `
    SELECT
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
  rows: Array<Array<string | number>>,
  headerRanges?: HeaderColorRanges
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  for (const row of rows) {
    worksheet.addRow(row);
  }

  if (headerRanges) {
    styleReportHeaders(worksheet, headerRanges);
  }
  styleDiscrepancyCells(worksheet);

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

  const buffer = await workbook.xlsx.writeBuffer();

  reply.header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  reply.header('Content-Disposition', 'attachment; filename=session-report.xlsx');
  reply.send(buffer);
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
