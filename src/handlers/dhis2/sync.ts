import { FastifyRequest, FastifyReply } from 'fastify';
import { dhis2Service } from '../../services/dhis2.service';
import { dhis2AggregationService } from '../../services/dhis2-aggregation.service';
import { dhis2MappingService } from '../../services/dhis2-mapping.service';
import { config } from '../../config/environment';
import { Dhis2SyncEvent, Site, Session } from '../../db/models';
import { SessionState } from '../../db/models/Session';

export const schema = {
  tags: ['DHIS2'],
  description: 'Sync VectorCam data to DHIS2 for a specific month',
  querystring: {
    type: 'object',
    required: ['year', 'month', 'district'],
    properties: {
      year: {
        type: 'number',
        description: 'Year (e.g., 2024)',
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
        description: 'District name to filter sites for sync (required)',
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
      properties: {
        success: { type: 'boolean' },
        year: { type: 'number' },
        month: { type: 'number' },
        dryRun: { type: 'boolean' },
        summary: {
          type: 'object',
          properties: {
            totalHouseholds: { type: 'number' },
            successfulSyncs: { type: 'number' },
            failedSyncs: { type: 'number' },
            skippedHouseholds: { type: 'number' },
          },
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              siteId: { type: 'number' },
              houseNumber: { type: 'string' },
              healthCenter: { type: 'string', nullable: true },
              status: { type: 'string', enum: ['success', 'failed', 'skipped'] },
              message: { type: 'string' },
              teiId: { type: 'string', nullable: true },
              eventId: { type: 'string', nullable: true },
              dataValuesCount: { type: 'number', nullable: true },
              dataValues: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    displayName: { type: 'string' },
                    dataElementId: { type: 'string' },
                    value: { type: ['string', 'number', 'boolean'] },
                  },
                },
              },
            },
          },
        },
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

interface QueryParams {
    year: number;
    month: number;
    district: string;
    dryRun?: boolean;
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

export async function syncToDHIS2(
  request: FastifyRequest<{ Querystring: QueryParams; Body: RequestBody }>,
  reply: FastifyReply
) {
    try {
        const { year, month, district, dryRun = false } = request.query;
        const { irsData = [] } = request.body || {};

        request.log.info(`Starting DHIS2 sync for ${year}-${month}${dryRun ? ' (dry run)' : ''}`);

        // Validate month/year
        if (month < 1 || month > 12) {
            return reply.code(400).send({ error: 'Invalid month. Must be between 1 and 12.' });
        }

        if (year < 2020 || year > 2100) {
            return reply.code(400).send({ error: 'Invalid year. Must be between 2020 and 2100.' });
        }

        // Get site access from middleware
        const siteAccess = request.siteAccess;
        if (!siteAccess) {
            return reply.code(500).send({ error: 'Site access information not available' });
        }

        // District is now required for all users
        if (!district) {
            return reply.code(400).send({ 
                error: 'District name is required' 
            });
        }

        // Create IRS data lookup map for quick access
        const irsDataMap = new Map<number, IrsData>();
        for (const data of irsData) {
            irsDataMap.set(data.siteId, data);
        }

        // Determine allowed site IDs based on user role and district filter
        // - Admin token: unrestricted, sync all sites in the district
        // - User JWT (privilege >= 2): scoped to their program's sites within the district
        let allowedSiteIds: number[];

        const sitesInDistrict = await Site.findAll({
            where: { district },
            attributes: ['id'],
        });

        const districtSiteIds = sitesInDistrict.map(site => site.id);

        if (request.isAdminToken) {
            allowedSiteIds = districtSiteIds;
            request.log.info(`Admin token syncing ${allowedSiteIds.length} sites in district "${district}"`);
        } else {
            // User JWT: intersect district sites with their program-scoped sites
            allowedSiteIds = siteAccess.userSites.filter(siteId => districtSiteIds.includes(siteId));

            if (allowedSiteIds.length === 0) {
                return reply.code(403).send({ 
                    error: `No accessible sites in district "${district}" within your program.` 
                });
            }

            request.log.info(`User syncing ${allowedSiteIds.length} program-scoped sites in district "${district}"`);
        }

        // Fetch data element map from DHIS2
        request.log.info('Fetching DHIS2 data element mappings...');
        let dataElementMap: Map<string, string>;
        let reverseDataElementMap: Map<string, string>;
        try {
            dataElementMap = await dhis2Service.getDataElementMap();
            reverseDataElementMap = createReverseMap(dataElementMap);
            request.log.info(`Loaded ${dataElementMap.size} data elements from DHIS2`);
        } catch (error: any) {
        request.log.error('Failed to fetch data element mappings:', error);
        return reply.code(500).send({
            error: `Failed to fetch DHIS2 data elements: ${error.message}`,
        });
        }

        // Get all household data for the specified month, filtered by allowed sites
        const householdDataList = await dhis2AggregationService.getHouseholdDataByMonth(
            year,
            month,
            allowedSiteIds
        );

        request.log.info(`Found ${householdDataList.length} households with data for ${year}-${month}`);

        const results: SyncResult[] = [];
        let successfulSyncs = 0;
        let failedSyncs = 0;
        let skippedHouseholds = 0;

        // Process each household
        for (const householdData of householdDataList) {
            const { site, sessions, surveillanceForm, specimenCounts } = householdData;

            try {
                // Validate required site information
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

                // In dry run mode, just validate the data without syncing
                if (dryRun) {
                    // Get the most recent session for this household
                    const latestSession = sessions.sort(
                        (a, b) => new Date(b.collectionDate!).getTime() - new Date(a.collectionDate!).getTime()
                    )[0];

                    // Get IRS override data for this site if provided
                    const irsOverride = irsDataMap.get(site.id);

                    // Map data to DHIS2 format
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

                // Search for the tracked entity instance in DHIS2
                const tei = await dhis2Service.searchTrackedEntityInstances(
                    site.healthCenter,
                    site.houseNumber
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

                // Get the most recent session for this household
                const latestSession = sessions.sort(
                    (a, b) => new Date(b.collectionDate!).getTime() - new Date(a.collectionDate!).getTime()
                )[0];

                // Use the current date as the event date
                const eventDate = new Date().toISOString().split('T')[0];

                // Get IRS override data for this site if provided
                const irsOverride = irsDataMap.get(site.id);

                // Map data to DHIS2 format
                const dataValues = dhis2MappingService.mapToDataValues(
                    latestSession,
                    surveillanceForm,
                    specimenCounts,
                    dataElementMap,
                    irsOverride
                );

                // Check if we've synced this site/month before (from our local tracking)
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
                    // Found in local database - update using stored event ID
                    request.log.info(`Re-syncing: Updating existing event ${existingSyncEvent.eventId} for site ${site.id}`);
                    eventResult = await dhis2Service.updateEvent(existingSyncEvent.eventId, {
                        program: config.dhis2.programId,
                        programStage: config.dhis2.programStageId,
                        orgUnit: tei.orgUnit,
                        trackedEntityInstance: tei.trackedEntityInstance,
                        eventDate,
                        dataValues,
                        status: 'COMPLETED',
                    });
                    
                    eventId = existingSyncEvent.eventId;
                    message = 'Event updated successfully (re-sync)';
                    
                    // Update last synced timestamp
                    await existingSyncEvent.update({
                        lastSyncedAt: new Date(),
                    });
                } else {
                    // Not found in local database - check DHIS2 API as safety measure
                    request.log.info(`No local record found for site ${site.id}, checking DHIS2 for existing event...`);
                    const dhis2Event = await dhis2Service.getExistingEvent(
                        tei.trackedEntityInstance, 
                        eventDate
                    );
                    
                    if (dhis2Event) {
                        // Found in DHIS2 but missing from local database - update and sync our database
                        request.log.info(`Found orphaned event ${dhis2Event.event} in DHIS2, updating and saving to local database`);
                        eventResult = await dhis2Service.updateEvent(dhis2Event.event, {
                            program: config.dhis2.programId,
                            programStage: config.dhis2.programStageId,
                            orgUnit: tei.orgUnit,
                            trackedEntityInstance: tei.trackedEntityInstance,
                            eventDate,
                            dataValues,
                            status: 'COMPLETED',
                        });
                        
                        eventId = dhis2Event.event;
                        message = 'Event updated successfully (recovered from DHIS2)';
                        
                        // Save to local database to avoid future API calls
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
                        // Not found anywhere - create new event
                        request.log.info(`First sync: Creating new event for site ${site.id}`);
                        eventResult = await dhis2Service.createEvent({
                            program: config.dhis2.programId,
                            programStage: config.dhis2.programStageId,
                            orgUnit: tei.orgUnit,
                            trackedEntityInstance: tei.trackedEntityInstance,
                            eventDate,
                            status: 'COMPLETED',
                            dataValues,
                        });

                        eventId = eventResult.response?.importSummaries?.[0]?.reference || null;
                        message = 'Event created successfully (first sync)';
                        
                        if (eventId) {
                            // Save sync event for future re-syncs
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

                // Mark all sessions for this household as SUBMITTED
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
                request.log.error(`Error syncing site ${site.id}:`, error);
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

        request.log.info(`DHIS2 sync completed for ${year}-${month}:`, summary);

        return reply.send({
            success: true,
            year,
            month,
            dryRun,
            summary,
            results,
        });
    } catch (error: any) {
        request.log.error('Error in DHIS2 sync:', error);
        return reply.code(500).send({
            error: error.message || 'Internal server error during DHIS2 sync',
        });
    }
}

