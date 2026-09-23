import 'dotenv/config';
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import sequelize from '../src/db';
import { Dhis2SyncEvent, Site } from '../src/db/models';

interface Dhis2Config {
  baseUrl: string;
  username: string;
  password: string;
  programId: string;
  programStageId: string;
}

interface SourceEvent {
  event: string;
  program: string;
  programStage: string;
  orgUnit: string;
  trackedEntityInstance: string;
  eventDate: string;
  status: string;
  dataValues: Array<{ dataElement: string; value: string | number | boolean }>;
}

interface MigrationArgs {
  execute: boolean;
  year?: number;
  month?: number;
  siteId?: number;
  limit?: number;
  logFile?: string;
}

interface MigrationLedgerEntry {
  sourceEventId: string;
  finalEventId: string | null;
  migratedAt: string;
  outcome?: 'success' | 'not_found_on_test';
}

interface MigrationLedgerFile {
  setup: {
    sourceBaseUrl: string;
    targetBaseUrl: string;
    programStageId: string;
  };
  migrations: Record<string, MigrationLedgerEntry>;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readConfig(prefix: 'SOURCE' | 'TARGET'): Dhis2Config {
  return {
    baseUrl: requiredEnv(`${prefix}_DHIS2_BASE_URL`).replace(/\/+$/, ''),
    username: requiredEnv(`${prefix}_DHIS2_USERNAME`),
    password: requiredEnv(`${prefix}_DHIS2_PASSWORD`),
    programId: requiredEnv(`${prefix}_DHIS2_PROGRAM_ID`),
    programStageId: requiredEnv(`${prefix}_DHIS2_PROGRAM_STAGE_ID`),
  };
}

function parsePositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv: string[]): MigrationArgs {
  const values = new Map<string, string>();
  let execute = false;

  for (const arg of argv) {
    if (arg === '--execute') {
      execute = true;
      continue;
    }

    const [name, value] = arg.split('=', 2);
    if (!name.startsWith('--') || value === undefined) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    values.set(name, value);
  }

  const month = parsePositiveInteger(values.get('--month'), '--month');
  if (month !== undefined && month > 12) {
    throw new Error('--month must be between 1 and 12');
  }

  const logFile = values.get('--log-file')?.trim();

  return {
    execute,
    year: parsePositiveInteger(values.get('--year'), '--year'),
    month,
    siteId: parsePositiveInteger(values.get('--site-id'), '--site-id'),
    limit: parsePositiveInteger(values.get('--limit'), '--limit'),
    logFile: logFile === '' ? undefined : logFile,
  };
}

function migrationLedgerKey(siteId: number, year: number, month: number): string {
  return `${siteId}:${year}:${month}`;
}

function migrationSetupFingerprint(source: Dhis2Config, target: Dhis2Config): string {
  return createHash('sha256')
    .update(`${source.baseUrl}|${target.baseUrl}|${source.programStageId}`)
    .digest('hex')
    .slice(0, 16);
}

function defaultMigrationLogPath(fingerprint: string): string {
  return join(__dirname, `.dhis2-events-migrated-${fingerprint}.json`);
}

function currentSetup(source: Dhis2Config, target: Dhis2Config): MigrationLedgerFile['setup'] {
  return {
    sourceBaseUrl: source.baseUrl,
    targetBaseUrl: target.baseUrl,
    programStageId: source.programStageId,
  };
}

function setupsMatch(
  a: MigrationLedgerFile['setup'],
  b: MigrationLedgerFile['setup']
): boolean {
  return (
    a.sourceBaseUrl === b.sourceBaseUrl &&
    a.targetBaseUrl === b.targetBaseUrl &&
    a.programStageId === b.programStageId
  );
}

async function loadMigrationLedger(
  logPath: string,
  setup: MigrationLedgerFile['setup']
): Promise<MigrationLedgerFile> {
  try {
    const raw = await readFile(logPath, 'utf8');
    const parsed = JSON.parse(raw) as MigrationLedgerFile;
    if (!parsed.migrations || typeof parsed.migrations !== 'object') {
      throw new Error('invalid migrations object');
    }
    if (!setupsMatch(parsed.setup, setup)) {
      throw new Error(
        'log file setup does not match current SOURCE_/TARGET_ env (source URL, target URL, program stage)'
      );
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { setup, migrations: {} };
    }
    throw error;
  }
}

async function saveMigrationLedger(
  logPath: string,
  ledger: MigrationLedgerFile
): Promise<void> {
  await writeFile(logPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

async function recordLedgerEntry(
  logPath: string,
  ledger: MigrationLedgerFile,
  siteId: number,
  year: number,
  month: number,
  sourceEventId: string,
  finalEventId: string | null,
  outcome: MigrationLedgerEntry['outcome'] = 'success'
): Promise<void> {
  ledger.migrations[migrationLedgerKey(siteId, year, month)] = {
    sourceEventId,
    finalEventId,
    migratedAt: new Date().toISOString(),
    outcome,
  };
  await saveMigrationLedger(logPath, ledger);
}

class Dhis2Client {
  private readonly authHeader: string;

  constructor(readonly config: Dhis2Config) {
    this.authHeader = `Basic ${Buffer.from(
      `${config.username}:${config.password}`
    ).toString('base64')}`;
  }

  private dhis2Error(message: string): Error {
    return new Error(`[${this.config.baseUrl}] ${message}`);
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const body = await response.text();
      throw this.dhis2Error(
        `${options.method ?? 'GET'} ${path} failed (${response.status}): ${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getEvent(eventId: string): Promise<SourceEvent | null> {
    const response = await fetch(
      `${this.config.baseUrl}/api/events/${encodeURIComponent(eventId)}.json` +
        '?fields=event,program,programStage,orgUnit,trackedEntityInstance,eventDate,status,dataValues[dataElement,value]',
      {
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw this.dhis2Error(
        `GET event ${eventId} failed (${response.status}): ${await response.text()}`
      );
    }
    return response.json() as Promise<SourceEvent>;
  }

  async eventExists(eventId: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.baseUrl}/api/events/${encodeURIComponent(eventId)}.json?fields=event`,
      { headers: { Authorization: this.authHeader } }
    );
    if (response.status === 404) return false;
    if (!response.ok) {
      throw this.dhis2Error(
        `GET event ${eventId} (exists check) failed (${response.status}): ${await response.text()}`
      );
    }
    return true;
  }

  async getDataElements(): Promise<Array<{ id: string; displayName: string }>> {
    const data = await this.request<{
      programStageDataElements: Array<{
        dataElement: { id: string; displayName: string };
      }>;
    }>(
      `/api/programStages/${encodeURIComponent(this.config.programStageId)}.json` +
        '?fields=programStageDataElements[dataElement[id,displayName]]'
    );
    return (data.programStageDataElements ?? []).map((entry) => entry.dataElement);
  }

  async findOrgUnit(name: string): Promise<{ id: string; name: string } | null> {
    const data = await this.request<{
      organisationUnits: Array<{ id: string; name: string }>;
    }>(
      `/api/organisationUnits.json?filter=name:eq:${encodeURIComponent(name)}` +
        '&fields=id,name&paging=false'
    );
    if (data.organisationUnits.length > 1) {
      throw this.dhis2Error(`Multiple organisation units have the name "${name}"`);
    }
    return data.organisationUnits[0] ?? null;
  }

  async findTei(
    orgUnitId: string,
    houseNumber: string
  ): Promise<{ trackedEntityInstance: string; orgUnit: string } | null> {
    const attributeData = await this.request<{
      trackedEntityAttributes: Array<{ id: string; displayName: string }>;
    }>(
      '/api/trackedEntityAttributes.json?filter=displayName:like:House%20Number' +
        '&fields=id,displayName&paging=false'
    );
    const attribute = attributeData.trackedEntityAttributes.find(
      (item) => item.displayName === 'MAL 001-ER05. House Number'
    ) ?? attributeData.trackedEntityAttributes[0];
    if (!attribute) {
      throw this.dhis2Error('House Number tracked entity attribute not found');
    }

    const data = await this.request<{
      trackedEntityInstances: Array<{
        trackedEntityInstance: string;
        orgUnit: string;
      }>;
    }>(
      `/api/trackedEntityInstances.json?ou=${encodeURIComponent(orgUnitId)}` +
        `&program=${encodeURIComponent(this.config.programId)}` +
        `&filter=${encodeURIComponent(attribute.id)}:eq:${encodeURIComponent(houseNumber)}` +
        '&fields=trackedEntityInstance,orgUnit&paging=false'
    );
    if (data.trackedEntityInstances.length > 1) {
      throw this.dhis2Error(
        `Multiple TEIs found for org unit ${orgUnitId}, house ${houseNumber}`
      );
    }
    return data.trackedEntityInstances[0] ?? null;
  }

  async getExistingEvent(
    teiId: string,
    eventDate: string
  ): Promise<{ event: string; eventDate: string } | null> {
    const data = await this.request<{ events?: Array<{ event: string; eventDate: string }> }>(
      `/api/events.json?trackedEntityInstance=${encodeURIComponent(teiId)}` +
        `&programStage=${encodeURIComponent(this.config.programStageId)}` +
        `&startDate=${encodeURIComponent(eventDate)}&endDate=${encodeURIComponent(eventDate)}` +
        '&fields=event,eventDate&paging=false'
    );
    return data.events?.[0] ?? null;
  }

  async createEvent(payload: Record<string, unknown>): Promise<string> {
    const data = await this.request<{
      response?: { importSummaries?: Array<{ reference?: string }> };
    }>('/api/events', { method: 'POST', body: payload });
    const eventId = data.response?.importSummaries?.[0]?.reference;
    if (!eventId) {
      throw this.dhis2Error('POST /api/events succeeded but response had no event id');
    }
    return eventId;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourceConfig = readConfig('SOURCE');
  const targetConfig = readConfig('TARGET');
  const source = new Dhis2Client(sourceConfig);
  const target = new Dhis2Client(targetConfig);

  if (sourceConfig.baseUrl === targetConfig.baseUrl) {
    throw new Error('Source and target DHIS2 URLs must be different');
  }

  await sequelize.authenticate();

  const [sourceElements, targetElements] = await Promise.all([
    source.getDataElements(),
    target.getDataElements(),
  ]);
  const sourceNameById = new Map(sourceElements.map((item) => [item.id, item.displayName]));
  const targetIdByName = new Map(targetElements.map((item) => [item.displayName, item.id]));

  const where: Record<string, unknown> = {
    programStageId: sourceConfig.programStageId,
  };
  if (args.year !== undefined) where.year = args.year;
  if (args.month !== undefined) where.month = args.month;
  if (args.siteId !== undefined) where.siteId = args.siteId;

  const syncEvents = await Dhis2SyncEvent.findAll({
    where,
    order: [
      ['year', 'ASC'],
      ['month', 'ASC'],
      ['siteId', 'ASC'],
    ],
    limit: args.limit,
  });

  const setup = currentSetup(sourceConfig, targetConfig);
  const logPath =
    args.logFile ?? defaultMigrationLogPath(migrationSetupFingerprint(sourceConfig, targetConfig));
  const ledger = await loadMigrationLedger(logPath, setup);
  const ledgerCount = Object.keys(ledger.migrations).length;

  console.log(
    `${args.execute ? 'EXECUTE' : 'DRY RUN'}: ${syncEvents.length} sync records selected, ${ledgerCount} in local log (${logPath})`
  );

  let migrated = 0;
  let skipped = 0;
  let notRetriable = 0;
  let failed = 0;

  for (const syncEvent of syncEvents) {
    const label = `site=${syncEvent.siteId} period=${syncEvent.year}-${syncEvent.month} dbEvent=${syncEvent.eventId}`;
    try {
      const ledgerEntry =
        ledger.migrations[migrationLedgerKey(syncEvent.siteId, syncEvent.year, syncEvent.month)];
      if (ledgerEntry) {
        if (ledgerEntry.outcome === 'not_found_on_test') {
          console.log(
            `SKIP ${label}: not retriable (recorded), test event ${ledgerEntry.sourceEventId} not on test DHIS2`
          );
        } else {
          console.log(
            `SKIP ${label} finalEvent=${ledgerEntry.finalEventId}: in local migration log (source was ${ledgerEntry.sourceEventId})`
          );
        }
        skipped++;
        continue;
      }

      const dbEventId = syncEvent.eventId;
      const [dbOnTest, dbOnLive] = await Promise.all([
        source.eventExists(dbEventId),
        target.eventExists(dbEventId),
      ]);

      if (dbOnLive) {
        await recordLedgerEntry(
          logPath,
          ledger,
          syncEvent.siteId,
          syncEvent.year,
          syncEvent.month,
          dbEventId,
          dbEventId
        );
        console.log(
          `SKIP ${label} test=${dbOnTest} live=${dbOnLive} finalEvent=${dbEventId}: db event id already on live DHIS2`
        );
        skipped++;
        continue;
      }

      if (!dbOnTest && !dbOnLive) {
        await recordLedgerEntry(
          logPath,
          ledger,
          syncEvent.siteId,
          syncEvent.year,
          syncEvent.month,
          dbEventId,
          null,
          'not_found_on_test'
        );
        console.log(
          `NOT_RETRIABLE ${label}: db event id ${dbEventId} not found on test or live DHIS2 (recorded, will not retry)`
        );
        notRetriable++;
        continue;
      }

      const site = await Site.findByPk(syncEvent.siteId);
      if (!site?.healthCenter || !site.houseNumber) {
        throw new Error('site is missing healthCenter or houseNumber');
      }

      const targetOrgUnit = await target.findOrgUnit(site.healthCenter);
      if (!targetOrgUnit) {
        throw new Error(`target org unit not found: "${site.healthCenter}"`);
      }
      const targetTei = await target.findTei(targetOrgUnit.id, site.houseNumber);
      if (!targetTei) {
        throw new Error(
          `target TEI not found for "${site.healthCenter}", house "${site.houseNumber}"`
        );
      }

      let sourceEvent: SourceEvent | null = null;
      if (dbOnTest) {
        sourceEvent = await source.getEvent(dbEventId);
        if (!sourceEvent) {
          await recordLedgerEntry(
            logPath,
            ledger,
            syncEvent.siteId,
            syncEvent.year,
            syncEvent.month,
            dbEventId,
            null,
            'not_found_on_test'
          );
          console.log(
            `NOT_RETRIABLE ${label}: test event ${dbEventId} no longer on test DHIS2 (recorded, will not retry)`
          );
          notRetriable++;
          continue;
        }
        if (sourceEvent.programStage !== sourceConfig.programStageId) {
          throw new Error(
            `test event belongs to unexpected program stage ${sourceEvent.programStage}`
          );
        }
        if (sourceEvent.program !== sourceConfig.programId) {
          throw new Error(`test event belongs to unexpected program ${sourceEvent.program}`);
        }
      }

      const eventDate = sourceEvent?.eventDate ?? syncEvent.eventDate;
      const existingLive = await target.getExistingEvent(
        targetTei.trackedEntityInstance,
        eventDate
      );

      if (existingLive) {
        const liveEventId = existingLive.event;
        if (syncEvent.eventId === liveEventId) {
          await recordLedgerEntry(
            logPath,
            ledger,
            syncEvent.siteId,
            syncEvent.year,
            syncEvent.month,
            dbEventId,
            liveEventId
          );
          console.log(`SKIP ${label} finalEvent=${liveEventId}: db already points at live event`);
          skipped++;
          continue;
        }

        console.log(
          `${args.execute ? 'UPDATE' : 'VALID'} ${label} finalEvent=${liveEventId}: live event exists for TEI/date, update db`
        );
        if (!args.execute) continue;

        const sourceEventIdForLog = dbOnTest ? dbEventId : syncEvent.eventId;
        await syncEvent.update({
          eventId: liveEventId,
          trackedEntityInstanceId: targetTei.trackedEntityInstance,
          organizationUnitId: targetTei.orgUnit,
          eventDate,
          lastSyncedAt: new Date(),
        });
        await recordLedgerEntry(
          logPath,
          ledger,
          syncEvent.siteId,
          syncEvent.year,
          syncEvent.month,
          sourceEventIdForLog,
          liveEventId
        );
        console.log(`UPDATE ${label} finalEvent=${liveEventId}: db updated`);
        migrated++;
        continue;
      }

      if (!sourceEvent) {
        await recordLedgerEntry(
          logPath,
          ledger,
          syncEvent.siteId,
          syncEvent.year,
          syncEvent.month,
          dbEventId,
          null,
          'not_found_on_test'
        );
        console.log(
          `NOT_RETRIABLE ${label}: db event id ${dbEventId} not found on test DHIS2 (recorded, will not retry)`
        );
        notRetriable++;
        continue;
      }

      const missingNames: string[] = [];
      const dataValues = sourceEvent.dataValues.map((dataValue) => {
        const displayName = sourceNameById.get(dataValue.dataElement);
        if (!displayName) {
          throw new Error(`source data element ${dataValue.dataElement} is not in source stage`);
        }
        const targetId = targetIdByName.get(displayName);
        if (!targetId) {
          missingNames.push(displayName);
        }
        return { dataElement: targetId ?? '', value: dataValue.value };
      });
      if (missingNames.length > 0) {
        throw new Error(`target stage is missing data elements: ${missingNames.join(', ')}`);
      }

      if (!args.execute) {
        console.log(
          `VALID ${label} finalEvent=(assigned by live DHIS2 on execute): copy test event to live, values=${dataValues.length}`
        );
        continue;
      }

      const liveEventId = await target.createEvent({
        program: targetConfig.programId,
        programStage: targetConfig.programStageId,
        orgUnit: targetTei.orgUnit,
        trackedEntityInstance: targetTei.trackedEntityInstance,
        eventDate: sourceEvent.eventDate,
        status: sourceEvent.status,
        dataValues,
      });

      await syncEvent.update({
        eventId: liveEventId,
        trackedEntityInstanceId: targetTei.trackedEntityInstance,
        organizationUnitId: targetTei.orgUnit,
        eventDate: sourceEvent.eventDate,
        lastSyncedAt: new Date(),
      });
      await recordLedgerEntry(
        logPath,
        ledger,
        syncEvent.siteId,
        syncEvent.year,
        syncEvent.month,
        dbEventId,
        liveEventId
      );
      console.log(
        `MIGRATE ${label} finalEvent=${liveEventId}: created on live and db updated, values=${dataValues.length}`
      );
      migrated++;
    } catch (error) {
      failed++;
      console.error(
        `FAIL ${label} (source=${sourceConfig.baseUrl}, target=${targetConfig.baseUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log(
    `Finished: migrated=${migrated}, skipped=${skipped}, notRetriable=${notRetriable}, failed=${failed}`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
