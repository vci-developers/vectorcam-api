import 'dotenv/config';
import { createHash } from 'crypto';
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

  return {
    execute,
    year: parsePositiveInteger(values.get('--year'), '--year'),
    month,
    siteId: parsePositiveInteger(values.get('--site-id'), '--site-id'),
    limit: parsePositiveInteger(values.get('--limit'), '--limit'),
  };
}

class Dhis2Client {
  private readonly authHeader: string;

  constructor(readonly config: Dhis2Config) {
    this.authHeader = `Basic ${Buffer.from(
      `${config.username}:${config.password}`
    ).toString('base64')}`;
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
      throw new Error(
        `${options.method ?? 'GET'} ${path} failed (${response.status}): ${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  async verifyAccess(): Promise<void> {
    await this.request('/api/me.json?fields=id');
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
      throw new Error(
        `GET source event ${eventId} failed (${response.status}): ${await response.text()}`
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
      throw new Error(
        `Checking target event ${eventId} failed (${response.status}): ${await response.text()}`
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
      throw new Error(`Multiple target organisation units have the name "${name}"`);
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
      throw new Error('House Number tracked entity attribute not found in target DHIS2');
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
      throw new Error(
        `Multiple target TEIs found for org unit ${orgUnitId}, house ${houseNumber}`
      );
    }
    return data.trackedEntityInstances[0] ?? null;
  }

  async createEvent(payload: Record<string, unknown>): Promise<void> {
    await this.request('/api/events', { method: 'POST', body: payload });
  }
}

function makeTargetKey(config: Dhis2Config): string {
  return createHash('sha256')
    .update(`${config.baseUrl}|${config.programId}|${config.programStageId}`)
    .digest('hex');
}

function makeEventUid(targetKey: string, sourceEventId: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const digest = createHash('sha256').update(`${targetKey}|${sourceEventId}`).digest();
  let uid = String.fromCharCode(65 + (digest[0] % 26));
  for (let index = 1; index < 11; index++) {
    uid += alphabet[digest[index] % alphabet.length];
  }
  return uid;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourceConfig = readConfig('SOURCE');
  const targetConfig = readConfig('TARGET');
  const source = new Dhis2Client(sourceConfig);
  const target = new Dhis2Client(targetConfig);
  const targetKey = makeTargetKey(targetConfig);

  if (sourceConfig.baseUrl === targetConfig.baseUrl) {
    throw new Error('Source and target DHIS2 URLs must be different');
  }
  if (sourceConfig.programStageId === targetConfig.programStageId) {
    throw new Error(
      'Source and target program-stage IDs must differ so both sync records can coexist'
    );
  }

  await sequelize.authenticate();
  await Promise.all([source.verifyAccess(), target.verifyAccess()]);

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

  console.log(
    `${args.execute ? 'EXECUTE' : 'DRY RUN'}: ${syncEvents.length} source sync records selected`
  );

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const syncEvent of syncEvents) {
    const label = `site=${syncEvent.siteId} period=${syncEvent.year}-${syncEvent.month} source=${syncEvent.eventId}`;
    try {
      const targetSyncEvent = await Dhis2SyncEvent.findOne({
        where: {
          programStageId: targetConfig.programStageId,
          siteId: syncEvent.siteId,
          year: syncEvent.year,
          month: syncEvent.month,
        },
      });
      if (targetSyncEvent) {
        console.log(
          `SKIP ${label}: live sync record already exists (${targetSyncEvent.eventId})`
        );
        skipped++;
        continue;
      }

      const site = await Site.findByPk(syncEvent.siteId);
      if (!site?.healthCenter || !site.houseNumber) {
        throw new Error('site is missing healthCenter or houseNumber');
      }

      const sourceEvent = await source.getEvent(syncEvent.eventId);
      if (!sourceEvent) {
        throw new Error('source event no longer exists');
      }
      if (sourceEvent.programStage !== sourceConfig.programStageId) {
        throw new Error(
          `source event belongs to unexpected program stage ${sourceEvent.programStage}`
        );
      }
      if (sourceEvent.program !== sourceConfig.programId) {
        throw new Error(`source event belongs to unexpected program ${sourceEvent.program}`);
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

      const targetEventId = makeEventUid(targetKey, sourceEvent.event);
      console.log(
        `${args.execute ? 'MIGRATE' : 'VALID'} ${label} -> target=${targetEventId}, values=${dataValues.length}`
      );
      if (!args.execute) continue;

      if (!await target.eventExists(targetEventId)) {
        await target.createEvent({
          event: targetEventId,
          program: targetConfig.programId,
          programStage: targetConfig.programStageId,
          orgUnit: targetTei.orgUnit,
          trackedEntityInstance: targetTei.trackedEntityInstance,
          eventDate: sourceEvent.eventDate,
          status: sourceEvent.status,
          dataValues,
        });
      }

      await Dhis2SyncEvent.create({
        programStageId: targetConfig.programStageId,
        siteId: syncEvent.siteId,
        year: syncEvent.year,
        month: syncEvent.month,
        eventId: targetEventId,
        trackedEntityInstanceId: targetTei.trackedEntityInstance,
        organizationUnitId: targetTei.orgUnit,
        eventDate: sourceEvent.eventDate,
        lastSyncedAt: new Date(),
      });
      migrated++;
    } catch (error) {
      failed++;
      console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Finished: migrated=${migrated}, skipped=${skipped}, failed=${failed}`);
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
