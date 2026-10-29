import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Form, FormQuestion, Site } from '../../db/models';
import {
  buildSiteSubtreeWhere,
  expandSiteIdsWithDescendants,
  parseSiteIds,
} from '../site/common';
import {
  hasRequiredSurveillanceMappings,
  resolveSurveillanceQuestionMappings,
  SurveillanceQuestionMappings,
} from './metricsSurveillanceQuestions';

export interface MetricsSiteScope {
  filteredSites: Site[];
  filteredSiteIds: number[];
  collectionSiteIds: number[];
  programIds: number[];
}

export interface MetricsSiteScopeQuery {
  district?: string;
  programId?: string | number;
  siteIds?: string;
}

export async function resolveMetricsSiteScope(
  request: FastifyRequest,
  reply: FastifyReply,
  query: MetricsSiteScopeQuery
): Promise<MetricsSiteScope | null> {
  const siteAccess = request.siteAccess;
  if (!siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access session metrics' });
    return null;
  }

  const { district, programId: programIdRaw, siteIds: siteIdsRaw } = query;
  const parsedProgramId = programIdRaw !== undefined && programIdRaw !== ''
    ? Number(programIdRaw)
    : undefined;
  if (programIdRaw !== undefined && programIdRaw !== '' && (parsedProgramId === undefined || !Number.isInteger(parsedProgramId) || parsedProgramId <= 0)) {
    reply.code(400).send({ error: 'programId must be a positive integer' });
    return null;
  }

  const requestedSiteIds = parseSiteIds(siteIdsRaw);
  const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);

  if (!district && parsedProgramId === undefined && requestedSiteIds.length === 0) {
    reply.code(400).send({ error: 'At least one of district, programId, or siteIds is required' });
    return null;
  }

  const siteWhere: any = {};
  if (district) {
    siteWhere.district = district;
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
      siteWhere[Op.and] = [...(siteWhere[Op.and] ?? []), subtreeWhere];
    }
  }

  const filteredSites = await Site.findAll({
    where: siteWhere,
    order: [['id', 'ASC']],
  });

  if (filteredSites.length === 0) {
    return {
      filteredSites: [],
      filteredSiteIds: [],
      collectionSiteIds: [],
      programIds: [],
    };
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

  const collectionSiteIds = filteredSites
    .filter((site) => !parentIdsWithChildren.has(site.id))
    .map((site) => site.id);

  const programIds = Array.from(new Set(filteredSites.map((site) => site.programId)));

  return {
    filteredSites,
    filteredSiteIds,
    collectionSiteIds,
    programIds,
  };
}

export async function resolveMetricsFormContext(programId: number): Promise<{
  programId: number;
  mappings: SurveillanceQuestionMappings;
} | null> {
  const formExists = await Form.count({ where: { programId } });
  if (formExists === 0) {
    return null;
  }

  const questions = await FormQuestion.findAll({
    attributes: ['id', 'label', 'type', 'questionKey'],
    include: [{
      model: Form,
      as: 'form',
      attributes: [],
      where: { programId },
      required: true,
    }],
  });

  if (questions.length === 0) {
    return null;
  }

  const uniqueByKey = new Map<string, FormQuestion>();
  for (const question of questions) {
    if (!uniqueByKey.has(question.questionKey)) {
      uniqueByKey.set(question.questionKey, question);
    }
  }

  const mappings = resolveSurveillanceQuestionMappings(Array.from(uniqueByKey.values()));
  if (!hasRequiredSurveillanceMappings(mappings)) {
    return null;
  }

  return { programId, mappings };
}

export async function countHousesUsedForCollection(
  filteredSites: Site[],
  collectionSiteIds: number[],
  useCollectionLeaves: boolean
): Promise<number> {
  if (useCollectionLeaves) {
    const collectionIdSet = new Set(collectionSiteIds);
    return filteredSites.filter((site) => site.isActive && collectionIdSet.has(site.id)).length;
  }

  return filteredSites.filter((site) => site.isActive).length;
}
