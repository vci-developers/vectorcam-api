import { FastifyReply, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';
import { Form, FormQuestion, Program, Session, Site } from '../../../db/models';
import { findSession } from '../common';

export interface FormAnswerInput {
  questionId: number;
  value: unknown;
  dataType?: string;
}

export async function loadSessionAndForm(
  request: FastifyRequest,
  reply: FastifyReply,
  sessionParam: string,
  explicitVersion?: string
): Promise<{ session: Session; form: Form; siteProgramId: number } | null> {
  const session = await findSession(sessionParam, [
    {
      model: Site,
      as: 'site',
      attributes: ['id', 'programId'],
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'formVersion'],
        }
      ]
    }
  ]);

  if (!session) {
    reply.code(404).send({ error: 'Session not found' });
    return null;
  }

  const site = session.get('site') as Site | null;
  if (!site) {
    reply.code(400).send({ error: 'Session does not have an associated site' });
    return null;
  }

  let program = site.get('program') as Program | null;
  if (!program) {
    program = await Program.findByPk(site.programId);
  }
  if (!program) {
    reply.code(400).send({ error: 'Session site missing program' });
    return null;
  }

  let form: Form | null = null;

  if (explicitVersion !== undefined) {
    if (explicitVersion === 'draft' || explicitVersion === 'dev' || explicitVersion === '') {
      reply.code(400).send({ error: 'Draft forms cannot be used for answers' });
      return null;
    }
    form = await Form.findOne({
      where: { programId: program.id, version: explicitVersion },
    });
    if (form?.version === '') {
      form = null;
    }
    if (!form) {
      reply.code(404).send({ error: `Requested version "${explicitVersion}" not found or not published` });
      return null;
    }
  } else {
    if (program.formVersion) {
      form = await Form.findOne({ where: { programId: program.id, version: program.formVersion } });
      if (form?.version === '') {
        form = null;
      }

      if (!form) {
        reply.code(404).send({ error: `Program formVersion "${program.formVersion}" not found or not published` });
        return null;
      }
    }

    if (!form) {
      form = await Form.findOne({
        where: { programId: program.id, version: { [Op.ne]: '' } },
        order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      });

      if (!form) {
        reply.code(404).send({ error: 'No published form available for this program' });
        return null;
      }
    }
  }

  return { session, form, siteProgramId: site.programId };
}

export async function fetchQuestionsMap(
  formId: number
): Promise<Map<number, FormQuestion>> {
  const questions = await FormQuestion.findAll({ where: { formId } });
  const questionMap = new Map<number, FormQuestion>();
  questions.forEach(q => questionMap.set(q.id, q));
  return questionMap;
}

