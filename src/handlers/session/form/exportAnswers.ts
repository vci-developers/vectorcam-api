import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { FormAnswer, Form, FormQuestion, Session, Site, Program } from '../../../db/models';
import { handleError } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Export dynamic form answers as CSV',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      programId: { type: 'number' },
      programCountry: { type: 'string' },
      version: { type: 'string' },
    },
  },
  response: {
    200: { type: 'string' },
    400: { type: 'object', properties: { error: { type: 'string' } } },
    500: { type: 'object', properties: { error: { type: 'string' } } },
  },
};

export interface ExportFormAnswersRequest {
  Querystring: {
    startDate?: string;
    endDate?: string;
    programId?: string;
    programCountry?: string;
    version?: string;
  };
}

function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('\r') || stringField.includes('"')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }

  return stringField;
}

export async function exportFormAnswersCSV(
  request: FastifyRequest<ExportFormAnswersRequest>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { startDate, endDate, programId, programCountry, version } = request.query;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before end date' });
    }

    const where: any = {};

    if (startDate && endDate) {
      where.submittedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.submittedAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.submittedAt = { [Op.lte]: new Date(endDate) };
    }

    const formWhere: any = { version: { [Op.ne]: '' } };
    if (version) {
      formWhere.version = version;
    }

    const programWhere: any = {};
    if (programId) {
      programWhere.id = parseInt(programId, 10);
    }
    if (programCountry) {
      programWhere.country = programCountry;
    }

    const answers = await FormAnswer.findAll({
      where,
      include: [
        {
          model: Form,
          as: 'form',
          where: formWhere,
          include: [
            {
              model: Program,
              as: 'program',
              where: Object.keys(programWhere).length ? programWhere : undefined,
            },
          ],
        },
        {
          model: Session,
          as: 'session',
          include: [{ model: Site, as: 'site' }],
        },
        { model: FormQuestion, as: 'question' },
      ],
      order: [['submittedAt', 'DESC']],
    });

    let csv = 'AnswerID,FormID,FormName,FormVersion,ProgramID,ProgramName,SessionID,SessionFrontendID,SiteID,QuestionID,QuestionLabel,QuestionType,Required,Value,DataType,SubmittedAt,CreatedAt,UpdatedAt\n';

    for (const answer of answers) {
      const form = answer.get('form') as Form | undefined;
      const program = form?.get('program') as Program | undefined;
      const session = answer.get('session') as Session | undefined;
      const site = session?.get('site') as Site | undefined;
      const question = answer.get('question') as FormQuestion | undefined;

      const row = [
        answer.id,
        form?.id ?? '',
        escapeCSVField(form?.name ?? ''),
        escapeCSVField(form?.version ?? ''),
        program?.id ?? '',
        escapeCSVField(program?.name ?? ''),
        answer.sessionId,
        escapeCSVField(session?.frontendId ?? ''),
        site?.id ?? '',
        answer.questionId,
        escapeCSVField(question?.label ?? ''),
        escapeCSVField(question?.type ?? ''),
        question?.required ?? '',
        escapeCSVField(
          answer.value === null || answer.value === undefined
            ? ''
            : typeof answer.value === 'string'
              ? answer.value
              : JSON.stringify(answer.value)
        ),
        escapeCSVField(answer.dataType),
        answer.submittedAt?.toISOString() ?? '',
        answer.createdAt?.toISOString() ?? '',
        answer.updatedAt?.toISOString() ?? '',
      ].join(',');

      csv += row + '\n';
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=form-answers.csv');

    return reply.send(csv);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to export form answers');
  }
}

