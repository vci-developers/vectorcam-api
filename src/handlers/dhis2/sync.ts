import { randomUUID } from 'crypto';
import { FastifyBaseLogger, FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { dhis2Service } from '../../services/dhis2.service';
import { dhis2AggregationService } from '../../services/dhis2-aggregation.service';
import { dhis2MappingService } from '../../services/dhis2-mapping.service';
import { config } from '../../config/environment';
import { CollectionCycle, Dhis2SyncEvent, Dhis2SyncTask, Site, Session } from '../../db/models';
import { SessionState } from '../../db/models/Session';
import { buildSiteSubtreeWhere, expandSiteIdsWithDescendants } from '../site/common';

const DHIS2_SYNC_TIMEOUT_SECONDS = 300;

export const schema = {
  tags: ['DHIS2'],
  description: 'Start an async sync of VectorCam data to DHIS2',
  querystring: {
    type: 'object',
    properties: {
      collectionCycleId: {
        type: 'number',
        description: 'Collection cycle ID to sync. Must be provided with siteId.',
      },
      siteId: {
        type: 'number',
        description: 'Site ID to sync. Must be provided with collectionCycleId.',
      },
      year: {
        type: 'number',
        description: 'Legacy monthly sync year (e.g., 2024)',
        minimum: 2020,
        maximum: 2100,
      },
      month: {
        type: 'number',
        description: 'Month (1-12)',
        minimum: 1,
        maximum: 12,
      },
      district: {
        type: 'string',
        description: 'Legacy monthly sync district name to filter sites',
      },
      siteIds: {
        type: 'string',
        description: 'Optional comma-separated site IDs to further limit the sync scope. Each ID is expanded to include its descendant sites.',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, performs validation only without syncing to DHIS2',
        default: false,
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      irsData: {
        type: 'array',
        description: 'Optional IRS (Indoor Residual Spraying) data per site',
        items: {
          type: 'object',
          required: ['siteId'],
          properties: {
            siteId: { type: 'number' },
            wasIrsSprayed: { type: 'boolean' },
            insecticideSprayed: { type: 'string' },
            dateLastSprayed: { type: 'string', format: 'date' },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      additionalProperties: true,
      description: 'Dry run validation result. No DHIS2 sync task is created.',
    },
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        taskId: { type: 'string' },
        collectionCycleId: { type: 'number', nullable: true },
        siteId: { type: 'number', nullable: true },
        status: { type: 'string' },
        timeoutSeconds: { type: 'number' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

const taskResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    tasks: {
      type: 'array',
      items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'timed_out'] },
        year: { type: 'number', nullable: true },
        month: { type: 'number', nullable: true },
        district: { type: 'string', nullable: true },
        siteIds: { type: 'array', nullable: true, items: { type: 'number' } },
        collectionCycleId: { type: 'number', nullable: true },
        siteId: { type: 'number', nullable: true },
        dryRun: { type: 'boolean' },
        timeoutSeconds: { type: 'number' },
        startedAt: { type: 'string', nullable: true },
        finishedAt: { type: 'string', nullable: true },
        error: { type: 'string', nullable: true },
        result: { type: 'object', nullable: true, additionalProperties: true },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
    },
  },
};

export const taskStatusSchema = {
  tags: ['DHIS2'],
  description: 'Get DHIS2 sync task status and result',
  params: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      collectionCycleId: { type: 'number' },
      siteId: { type: 'number' },
    },
  },
  response: {
    200: taskResponseSchema,
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

interface QueryParams {
    collectionCycleId?: number;
    siteId?: number;
    year?: number;
    month?: number;
    district?: string;
    siteIds?: string;
    dryRun?: boolean;
}

interface TaskStatusQueryParams {
    collectionCycleId?: number;
    siteId?: number;
}

function parseSiteIdsParam(value?: string): number[] {
    if (!value) return [];
    return Array.from(new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .map((entry) => Number(entry))
            .filter((id) => Number.isInteger(id) && id > 0)
    ));
}

interface IrsData {
    siteId: number;
    wasIrsSprayed?: boolean;
    insecticideSprayed?: string;
    dateLastSprayed?: string;
}

interface RequestBody {
    irsData?: IrsData[];
}

interface DataValueWithName {
    displayName: string;
    dataElementId: string;
    value: string | number | boolean;
}

interface SyncResult {
    siteId: number;
    houseNumber: string;
    healthCenter: string | null;
    status: 'success' | 'failed' | 'skipped';
    message: string;
    teiId?: string | null;
    eventId?: string | null;
    dataValuesCount?: number | null;
    dataValues?: DataValueWithName[] | null;
}

/**
 * Helper function to create a reverse map (ID -> display name)
 */
function createReverseMap(dataElementMap: Map<string, string>): Map<string, string> {
    const reverseMap = new Map<string, string>();
    for (const [displayName, id] of dataElementMap.entries()) {
        reverseMap.set(id, displayName);
    }
    return reverseMap;
}

/**
 * Helper function to enrich data values with display names
 */
function enrichDataValues(
    dataValues: Array<{ dataElement: string; value: string | number | boolean }>,
    reverseMap: Map<string, string>
): DataValueWithName[] {
    return dataValues.map(dv => ({
        displayName: reverseMap.get(dv.dataElement) || 'Unknown',
        dataElementId: dv.dataElement,
        value: dv.value,
    }));
}

interface SyncTaskInput {
    year: number;
    month: number;
    district: string | null;
    requestedSiteIds: number[];
    allowedSiteIds: number[];
    collectionCycleId: number | null;
    siteId: number | null;
    dryRun: boolean;
    irsData: IrsData[];
}

interface SyncTaskResult {
    success: boolean;
    year: number;
    month: number;
    dryRun: boolean;
    summary: {
        totalHouseholds: number;
        successfulSyncs: number;
        failedSyncs: number;
        skippedHouseholds: number;
    };
    results: SyncResult[];
}

class HttpError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

function isAbortError(error: any): boolean {
    return error?.name === 'AbortError' || error?.name === 'TimeoutError';
}

function getAbortMessage(signal: AbortSignal, fallback: string): string {
    const reason = signal.reason as Error | string | undefined;
    if (reason instanceof Error) {
        return reason.message;
    }
    if (typeof reason === 'string') {
        return reason;
    }
    return fallback;
}

async function buildSyncTaskInput(
    request: FastifyRequest,
    params: {
        collectionCycleId?: number;
        siteId?: number;
        year?: number;
        month?: number;
        district?: string;
        requestedSiteIds: number[];
        dryRun: boolean;
        irsData: IrsData[];
    }
): Promise<SyncTaskInput> {
    const { collectionCycleId, siteId, year, month, district, requestedSiteIds, dryRun, irsData } = params;

    if ((collectionCycleId == null) !== (siteId == null)) {
        throw new HttpError(400, 'collectionCycleId and siteId must be provided together.');
    }

    const siteAccess = request.siteAccess;
    if (!siteAccess) {
        throw new HttpError(500, 'Site access information not available');
    }

    if (collectionCycleId != null && siteId != null) {
        const [cycle, site] = await Promise.all([
            CollectionCycle.findByPk(collectionCycleId),
            Site.findByPk(siteId),
        ]);

        if (!cycle) {
            throw new HttpError(404, 'Collection cycle not found');
        }

        if (!site) {
            throw new HttpError(404, 'Site not found');
        }

        if (cycle.programId !== site.programId) {
            throw new HttpError(400, 'Collection cycle and site must belong to the same program.');
        }

        if (!request.isAdminToken) {
            const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);
            if (!accessibleSiteIds.includes(siteId)) {
                throw new HttpError(403, 'No access to the requested site.');
            }
        }

        const cycleStartDate = new Date(cycle.startDate);

        return {
            year: cycleStartDate.getUTCFullYear(),
            month: cycleStartDate.getUTCMonth() + 1,
            district: site.district,
            requestedSiteIds: [siteId],
            allowedSiteIds: [siteId],
            collectionCycleId,
            siteId,
            dryRun,
            irsData,
        };
    }

    if (year == null || month == null || !district) {
        throw new HttpError(400, 'Legacy sync requires year, month, and district.');
    }

    if (month < 1 || month > 12) {
        throw new HttpError(400, 'Invalid month. Must be between 1 and 12.');
    }

    if (year < 2020 || year > 2100) {
        throw new HttpError(400, 'Invalid year. Must be between 2020 and 2100.');
    }

    let allowedSiteIds: number[];

    const siteWhere: any = { district };
    if (requestedSiteIds.length > 0) {
        const subtreeWhere = buildSiteSubtreeWhere(requestedSiteIds);
        if (subtreeWhere) {
            siteWhere[Op.and] = [subtreeWhere];
        }
    }

    const sitesInDistrict = await Site.findAll({
        where: siteWhere,
        attributes: ['id'],
    });

    const districtSiteIds = sitesInDistrict.map(site => site.id);

    if (requestedSiteIds.length > 0 && districtSiteIds.length === 0) {
        throw new HttpError(400, `No sites in district "${district}" match the provided siteIds filter.`);
    }

    if (request.isAdminToken) {
        allowedSiteIds = districtSiteIds;
        request.log.info(`Admin token queued DHIS2 sync for ${allowedSiteIds.length} sites in district "${district}"`);
    } else {
        const accessibleSiteIds = await expandSiteIdsWithDescendants(siteAccess.userSites ?? []);
        allowedSiteIds = districtSiteIds.filter((siteId) => accessibleSiteIds.includes(siteId));

        if (allowedSiteIds.length === 0) {
            throw new HttpError(403, `No accessible sites in district "${district}" within your program.`);
        }

        request.log.info(`User queued DHIS2 sync for ${allowedSiteIds.length} program-scoped sites in district "${district}"`);
    }

    return {
        year,
        month,
        district,
        requestedSiteIds,
        allowedSiteIds,
        collectionCycleId: null,
        siteId: null,
        dryRun,
        irsData,
    };
}

async function createAndStartSyncTask(
    input: SyncTaskInput,
    request: FastifyRequest
): Promise<Dhis2SyncTask> {
    if (input.dryRun) {
        throw new Error('Dry run requests should not create DHIS2 sync tasks');
    }

    const task = await Dhis2SyncTask.create({
        id: randomUUID(),
        status: 'pending',
        year: input.year,
        month: input.month,
        district: input.district,
        siteIds: input.requestedSiteIds.length > 0 ? input.requestedSiteIds : null,
        collectionCycleId: input.collectionCycleId,
        siteId: input.siteId,
        dryRun: input.dryRun,
        requestBody: { irsData: input.irsData },
        requestedByUserId: request.user?.id ?? null,
        requestedByAuthType: request.authType ?? null,
        timeoutSeconds: DHIS2_SYNC_TIMEOUT_SECONDS,
    });

    startDhis2SyncTask(task.id, input, request.log);
    return task;
}

function startDhis2SyncTask(taskId: string, input: SyncTaskInput, log: FastifyBaseLogger): void {
    setImmediate(() => {
        void runDhis2SyncTask(taskId, input, log).catch((error) => {
            log.error({ err: error, taskId }, 'Unhandled DHIS2 sync task error');
        });
    });
}

async function runDhis2SyncTask(
    taskId: string,
    input: SyncTaskInput,
    log: FastifyBaseLogger
): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort(new Error(`DHIS2 sync task timed out after ${DHIS2_SYNC_TIMEOUT_SECONDS} seconds`));
    }, DHIS2_SYNC_TIMEOUT_SECONDS * 1000);

    try {
        const [startedCount] = await Dhis2SyncTask.update(
            {
                status: 'running',
                startedAt: new Date(),
                error: null,
            },
            { where: { id: taskId, status: 'pending' } }
        );
        if (startedCount === 0) {
            log.warn({ taskId }, 'DHIS2 sync task was not pending when the worker started');
            return;
        }

        const result = await performDhis2Sync(input, log, controller.signal);
        controller.signal.throwIfAborted();

        await Dhis2SyncTask.update(
            {
                status: 'completed',
                finishedAt: new Date(),
                result,
                error: null,
            },
            { where: { id: taskId, status: 'running' } }
        );
    } catch (error: any) {
        const timedOut = controller.signal.aborted || isAbortError(error);
        const message = timedOut
            ? getAbortMessage(controller.signal, `DHIS2 sync task timed out after ${DHIS2_SYNC_TIMEOUT_SECONDS} seconds`)
            : error.message || 'Internal server error during DHIS2 sync';

        await Dhis2SyncTask.update(
            {
                status: timedOut ? 'timed_out' : 'failed',
                finishedAt: new Date(),
                error: message,
            },
            { where: { id: taskId, status: 'running' } }
        );

        log.error({ err: error, taskId }, `DHIS2 sync task ${timedOut ? 'timed out' : 'failed'}`);
    } finally {
        clearTimeout(timeout);
    }
}

async function performDhis2Sync(
    input: SyncTaskInput,
    log: FastifyBaseLogger,
    signal: AbortSignal
): Promise<SyncTaskResult> {
    const { year, month, dryRun, allowedSiteIds, collectionCycleId, siteId, irsData } = input;
    const irsDataMap = new Map<number, IrsData>();
    for (const data of irsData) {
        irsDataMap.set(data.siteId, data);
    }

    log.info(`Starting DHIS2 sync for ${year}-${month}${dryRun ? ' (dry run)' : ''}`);
    log.info('Fetching DHIS2 data element mappings...');

    const dataElementMap = await dhis2Service.getDataElementMap({ signal });
    const reverseDataElementMap = createReverseMap(dataElementMap);
    log.info(`Loaded ${dataElementMap.size} data elements from DHIS2`);

    const householdDataList = collectionCycleId != null && siteId != null
        ? await dhis2AggregationService.getHouseholdDataByCollectionCycle(collectionCycleId, siteId)
        : await dhis2AggregationService.getHouseholdDataByMonth(year, month, allowedSiteIds);

    log.info(`Found ${householdDataList.length} households with data for ${year}-${month}`);

    const results: SyncResult[] = [];
    let successfulSyncs = 0;
    let failedSyncs = 0;
    let skippedHouseholds = 0;

    for (const householdData of householdDataList) {
        signal.throwIfAborted();
        const { site, sessions, surveillanceForm, specimenCounts } = householdData;

        try {
            if (!site.healthCenter) {
                skippedHouseholds++;
                results.push({
                    siteId: site.id,
                    houseNumber: site.houseNumber,
                    healthCenter: site.healthCenter,
                    status: 'skipped',
                    message: 'Site missing health center information',
                });
                continue;
            }

            if (!site.houseNumber) {
                skippedHouseholds++;
                results.push({
                    siteId: site.id,
                    houseNumber: site.houseNumber,
                    healthCenter: site.healthCenter,
                    status: 'skipped',
                    message: 'Site missing house number',
                });
                continue;
            }

            if (dryRun) {
                const latestSession = sessions.sort(
                    (a, b) => new Date(b.collectionDate!).getTime() - new Date(a.collectionDate!).getTime()
                )[0];

                const irsOverride = irsDataMap.get(site.id);
                const dataValues = dhis2MappingService.mapToDataValues(
                    latestSession,
                    surveillanceForm,
                    specimenCounts,
                    dataElementMap,
                    irsOverride
                );

                successfulSyncs++;
                results.push({
                    siteId: site.id,
                    houseNumber: site.houseNumber,
                    healthCenter: site.healthCenter,
                    status: 'success',
                    message: 'Validation successful (dry run)',
                    dataValuesCount: dataValues.length,
                    dataValues: enrichDataValues(dataValues, reverseDataElementMap),
                });
                continue;
            }

            const tei = await dhis2Service.searchTrackedEntityInstances(
                site.healthCenter,
                site.houseNumber,
                { signal }
            );

            if (!tei) {
                skippedHouseholds++;
                results.push({
                    siteId: site.id,
                    houseNumber: site.houseNumber,
                    healthCenter: site.healthCenter,
                    status: 'skipped',
                    message: `No tracked entity instance found in DHIS2 for health center "${site.healthCenter}" and house number "${site.houseNumber}"`,
                });
                continue;
            }

            const latestSession = sessions.sort(
                (a, b) => new Date(b.collectionDate!).getTime() - new Date(a.collectionDate!).getTime()
            )[0];
            const eventDate = new Date().toISOString().split('T')[0];
            const irsOverride = irsDataMap.get(site.id);
            const dataValues = dhis2MappingService.mapToDataValues(
                latestSession,
                surveillanceForm,
                specimenCounts,
                dataElementMap,
                irsOverride
            );

            const existingSyncEvent = await Dhis2SyncEvent.findOne({
                where: {
                    programStageId: config.dhis2.programStageId,
                    siteId: site.id,
                    year,
                    month,
                },
            });

            let eventResult;
            let eventId: string | null = null;
            let message: string;

            if (existingSyncEvent) {
                log.info(`Re-syncing: Updating existing event ${existingSyncEvent.eventId} for site ${site.id}`);
                eventResult = await dhis2Service.updateEvent(existingSyncEvent.eventId, {
                    program: config.dhis2.programId,
                    programStage: config.dhis2.programStageId,
                    orgUnit: tei.orgUnit,
                    trackedEntityInstance: tei.trackedEntityInstance,
                    eventDate,
                    dataValues,
                    status: 'COMPLETED',
                }, { signal });

                eventId = existingSyncEvent.eventId;
                message = 'Event updated successfully (re-sync)';

                await existingSyncEvent.update({
                    lastSyncedAt: new Date(),
                });
            } else {
                log.info(`No local record found for site ${site.id}, checking DHIS2 for existing event...`);
                const dhis2Event = await dhis2Service.getExistingEvent(
                    tei.trackedEntityInstance,
                    eventDate,
                    { signal }
                );

                if (dhis2Event) {
                    log.info(`Found orphaned event ${dhis2Event.event} in DHIS2, updating and saving to local database`);
                    eventResult = await dhis2Service.updateEvent(dhis2Event.event, {
                        program: config.dhis2.programId,
                        programStage: config.dhis2.programStageId,
                        orgUnit: tei.orgUnit,
                        trackedEntityInstance: tei.trackedEntityInstance,
                        eventDate,
                        dataValues,
                        status: 'COMPLETED',
                    }, { signal });

                    eventId = dhis2Event.event;
                    message = 'Event updated successfully (recovered from DHIS2)';

                    await Dhis2SyncEvent.create({
                        programStageId: config.dhis2.programStageId,
                        siteId: site.id,
                        year,
                        month,
                        eventId,
                        trackedEntityInstanceId: tei.trackedEntityInstance,
                        organizationUnitId: tei.orgUnit,
                        eventDate,
                        lastSyncedAt: new Date(),
                    });
                } else {
                    log.info(`First sync: Creating new event for site ${site.id}`);
                    eventResult = await dhis2Service.createEvent({
                        program: config.dhis2.programId,
                        programStage: config.dhis2.programStageId,
                        orgUnit: tei.orgUnit,
                        trackedEntityInstance: tei.trackedEntityInstance,
                        eventDate,
                        status: 'COMPLETED',
                        dataValues,
                    }, { signal });

                    eventId = eventResult.response?.importSummaries?.[0]?.reference || null;
                    message = 'Event created successfully (first sync)';

                    if (eventId) {
                        await Dhis2SyncEvent.create({
                            programStageId: config.dhis2.programStageId,
                            siteId: site.id,
                            year,
                            month,
                            eventId,
                            trackedEntityInstanceId: tei.trackedEntityInstance,
                            organizationUnitId: tei.orgUnit,
                            eventDate,
                            lastSyncedAt: new Date(),
                        });
                    }
                }
            }

            const sessionIds = sessions.map(s => s.id);
            await Session.update(
                { state: SessionState.SUBMITTED },
                { where: { id: sessionIds } }
            );

            successfulSyncs++;
            results.push({
                siteId: site.id,
                houseNumber: site.houseNumber,
                healthCenter: site.healthCenter,
                status: 'success',
                message,
                teiId: tei.trackedEntityInstance,
                eventId,
                dataValuesCount: dataValues.length,
                dataValues: enrichDataValues(dataValues, reverseDataElementMap),
            });
        } catch (error: any) {
            if (signal.aborted || isAbortError(error)) {
                throw error;
            }

            log.error(`Error syncing site ${site.id}:`, error);
            failedSyncs++;
            results.push({
                siteId: site.id,
                houseNumber: site.houseNumber,
                healthCenter: site.healthCenter,
                status: 'failed',
                message: error.message || 'Unknown error occurred',
            });
        }
    }

    const summary = {
        totalHouseholds: householdDataList.length,
        successfulSyncs,
        failedSyncs,
        skippedHouseholds,
    };

    log.info(`DHIS2 sync completed for ${year}-${month}:`, summary);

    return {
        success: true,
        year,
        month,
        dryRun,
        summary,
        results,
    };
}

function serializeTask(task: Dhis2SyncTask) {
    return {
        id: task.id,
        status: task.status,
        year: task.year,
        month: task.month,
        district: task.district,
        siteIds: task.siteIds,
        collectionCycleId: task.collectionCycleId,
        siteId: task.siteId,
        dryRun: task.dryRun,
        timeoutSeconds: task.timeoutSeconds,
        startedAt: task.startedAt?.toISOString() ?? null,
        finishedAt: task.finishedAt?.toISOString() ?? null,
        error: task.error,
        result: task.result,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
    };
}

async function markTimedOutIfExpired(task: Dhis2SyncTask): Promise<void> {
    if (task.status !== 'pending' && task.status !== 'running') {
        return;
    }

    const timeoutSeconds = task.timeoutSeconds || DHIS2_SYNC_TIMEOUT_SECONDS;
    const startedAt = task.startedAt ?? task.createdAt;
    const elapsedMs = Date.now() - new Date(startedAt).getTime();

    if (elapsedMs < timeoutSeconds * 1000) {
        return;
    }

    await task.update({
        status: 'timed_out',
        finishedAt: task.finishedAt ?? new Date(),
        error: `DHIS2 sync task timed out after ${timeoutSeconds} seconds`,
    });
}

export async function syncToDHIS2(
  request: FastifyRequest<{ Querystring: QueryParams; Body: RequestBody }>,
  reply: FastifyReply
) {
    try {
        const {
            collectionCycleId,
            siteId,
            year,
            month,
            district,
            siteIds: siteIdsParam,
            dryRun = false,
        } = request.query;
        const { irsData = [] } = request.body || {};
        const requestedSiteIds = parseSiteIdsParam(siteIdsParam);
        const input = await buildSyncTaskInput(request, {
            collectionCycleId,
            siteId,
            year,
            month,
            district,
            requestedSiteIds,
            dryRun,
            irsData,
        });

        if (dryRun) {
            const controller = new AbortController();
            const result = await performDhis2Sync(input, request.log, controller.signal);
            return reply.send(result);
        }

        const task = await createAndStartSyncTask(input, request);

        return reply.code(202).send({
            success: true,
            taskId: task.id,
            collectionCycleId: task.collectionCycleId,
            siteId: task.siteId,
            status: task.status,
            timeoutSeconds: task.timeoutSeconds,
        });
    } catch (error: any) {
        request.log.error('Error handling DHIS2 sync request:', error);
        if (error instanceof HttpError) {
            return reply.code(error.statusCode).send({ error: error.message });
        }

        return reply.code(500).send({
            error: error.message || 'Internal server error while handling DHIS2 sync request',
        });
    }
}

export async function getDhis2SyncTask(
    request: FastifyRequest<{ Params: { taskId?: string }; Querystring: TaskStatusQueryParams }>,
    reply: FastifyReply
) {
    const taskId = request.params.taskId;

    if (taskId) {
        const task = await Dhis2SyncTask.findByPk(taskId);
        if (!task) {
            return reply.code(404).send({ error: 'DHIS2 sync task not found' });
        }

        await markTimedOutIfExpired(task);
        await task.reload();

        return reply.send({
            success: true,
            tasks: [serializeTask(task)],
        });
    }

    const { collectionCycleId, siteId } = request.query;
    if (collectionCycleId == null || siteId == null) {
        return reply.code(400).send({
            error: 'Provide either a taskId path parameter or both collectionCycleId and siteId query parameters.',
        });
    }

    const tasks = await Dhis2SyncTask.findAll({
        where: {
            collectionCycleId,
            siteId,
        },
        order: [['createdAt', 'DESC']],
    });

    await Promise.all(tasks.map(async (task) => {
        await markTimedOutIfExpired(task);
        await task.reload();
    }));

    return reply.send({
        success: true,
        tasks: tasks.map(serializeTask),
    });
}
