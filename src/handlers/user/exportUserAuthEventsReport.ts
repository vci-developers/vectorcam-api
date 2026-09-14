import { FastifyReply, FastifyRequest } from 'fastify';
import ExcelJS from 'exceljs';
import {
  buildDailyLoginsSheetRows,
  buildUniqueUsersSheetRows,
  getActivityDateBounds,
  getDatesInRange,
  isValidDateOnly,
  queryUserLoginActivity,
} from './userLoginActivity';

interface ReportQuery {
  startDate: string;
  endDate: string;
  programId?: number;
  userId?: number;
}

export const exportUserAuthEventsReportSchema: any = {
  tags: ['Users'],
  summary: 'Export user login activity report',
  description: 'Export unique users and daily login counts as XLSX (requires admin token or developer user)',
  querystring: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
      startDate: { type: 'string', description: 'Inclusive start date (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'Inclusive end date (YYYY-MM-DD)' },
      programId: { type: 'number', description: 'Filter by program ID' },
      userId: { type: 'number', description: 'Filter by user ID' },
    },
  },
  response: {
    200: { type: 'string' },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    401: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    500: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export interface ExportUserAuthEventsReportRequest {
  Querystring: ReportQuery;
}

function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    };
  });
}

async function sendWorkbook(
  reply: FastifyReply,
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  for (const sheetSpec of sheets) {
    const worksheet = workbook.addWorksheet(sheetSpec.name);
    for (const row of sheetSpec.rows) {
      worksheet.addRow(row);
    }
    styleHeaderRow(worksheet);

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
  reply.header('Content-Disposition', 'attachment; filename=user-auth-events-report.xlsx');
  reply.send(buffer);
}

export async function exportUserAuthEventsReportHandler(
  request: FastifyRequest<ExportUserAuthEventsReportRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, programId, userId } = request.query;

    if (!isValidDateOnly(startDate)) {
      return reply.code(400).send({ error: 'startDate must be YYYY-MM-DD' });
    }

    if (!isValidDateOnly(endDate)) {
      return reply.code(400).send({ error: 'endDate must be YYYY-MM-DD' });
    }

    if (new Date(`${startDate}T00:00:00.000Z`) > new Date(`${endDate}T00:00:00.000Z`)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    const users = await queryUserLoginActivity({
      ...getActivityDateBounds(startDate, endDate),
      programId,
      userId,
    });

    const dates = getDatesInRange(startDate, endDate);

    return await sendWorkbook(reply, [
      {
        name: 'unique-users',
        rows: buildUniqueUsersSheetRows(users),
      },
      {
        name: 'daily-logins',
        rows: buildDailyLoginsSheetRows(users, dates),
      },
    ]);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to export user auth events report' });
  }
}
