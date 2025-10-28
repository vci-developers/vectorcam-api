import { config } from '../config/environment';
import Dhis2Cache from '../db/models/Dhis2Cache';

export interface TrackedEntityInstance {
  trackedEntityInstance: string;
  orgUnit: string;
  attributes: Array<{
    attribute: string;
    value: string;
    displayName?: string;
  }>;
}

export interface DataElement {
  id: string;
  displayName: string;
  valueType: string;
}

export interface EventDataValue {
  dataElement: string;
  value: string | number | boolean;
}

export interface Event {
  program: string;
  programStage: string;
  orgUnit: string;
  trackedEntityInstance: string;
  eventDate: string;
  status: 'COMPLETED' | 'ACTIVE' | 'SCHEDULE';
  dataValues: EventDataValue[];
}

class DHIS2Service {
  private baseUrl: string;
  private authHeader: string;
  private programStageId: string;

  constructor() {
    this.baseUrl = config.dhis2.baseUrl;
    this.programStageId = config.dhis2.programStageId;
    const auth = Buffer.from(
      `${config.dhis2.username}:${config.dhis2.password}`
    ).toString('base64');
    this.authHeader = `Basic ${auth}`;
  }

  /**
   * Search for Tracked Entity Instances by organization unit and attribute filter
   */
  private async getFromCache<T>(
    cacheType: 'orgUnit' | 'tei' | 'dataElementMap',
    cacheKey: string
  ): Promise<T | null> {
    try {
      const cached = await Dhis2Cache.findOne({
        where: {
          programStageId: this.programStageId,
          cacheType,
          cacheKey,
        },
      });

      if (cached) {
        return JSON.parse(cached.cacheValue) as T;
      }

      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Save value to cache in database
   */
  private async saveToCache(
    cacheType: 'orgUnit' | 'tei' | 'dataElementMap',
    cacheKey: string,
    value: any
  ): Promise<void> {
    try {
      await Dhis2Cache.upsert({
        programStageId: this.programStageId,
        cacheType,
        cacheKey,
        cacheValue: JSON.stringify(value),
      });
    } catch (error) {
      console.error('Error saving to cache:', error);
      // Don't throw - caching is not critical
    }
  }

  /**
   * Get organization unit ID by name (with database caching)
   */
  private async getOrgUnitId(healthCenterName: string): Promise<string | null> {
    // Check cache first
    const cached = await this.getFromCache<string>('orgUnit', healthCenterName);
    if (cached) {
      return cached;
    }

    // Fetch from DHIS2
    const orgUnitResponse = await fetch(
      `${this.baseUrl}/api/organisationUnits.json?filter=name:eq:${encodeURIComponent(healthCenterName)}&fields=id,name&paging=false`,
      {
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!orgUnitResponse.ok) {
      throw new Error(`Failed to fetch organization unit: ${orgUnitResponse.statusText}`);
    }

    const orgUnitData = await orgUnitResponse.json() as any;
    
    if (!orgUnitData.organisationUnits || orgUnitData.organisationUnits.length === 0) {
      return null;
    }

    const orgUnitId = orgUnitData.organisationUnits[0].id;

    // Save to cache
    await this.saveToCache('orgUnit', healthCenterName, orgUnitId);

    return orgUnitId;
  }

  /**
   * Search for Tracked Entity Instances by organization unit and attribute filter (with database caching)
   */
  async searchTrackedEntityInstances(
    orgUnitName: string,
    houseNumber: string
  ): Promise<TrackedEntityInstance | null> {
    try {
      // Check cache first - cache key is house number only
      const cached = await this.getFromCache<TrackedEntityInstance>('tei', houseNumber);
      if (cached) {
        return cached;
      }

      // Get organization unit ID (uses cache internally)
      const orgUnitId = await this.getOrgUnitId(orgUnitName);
      if (!orgUnitId) {
        return null;
      }

      // Search for TEI with the house number attribute
      // First, find the attribute ID for "MAL 001-ER05. House Number"
      const attributesResponse = await fetch(
        `${this.baseUrl}/api/trackedEntityAttributes.json?filter=displayName:like:House Number&fields=id,displayName&paging=false`,
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!attributesResponse.ok) {
        throw new Error(`Failed to fetch attributes: ${attributesResponse.statusText}`);
      }

      const attributesData = await attributesResponse.json() as any;
      
      if (!attributesData.trackedEntityAttributes || attributesData.trackedEntityAttributes.length === 0) {
        throw new Error('House Number attribute not found in DHIS2');
      }

      const houseNumberAttributeId = attributesData.trackedEntityAttributes[0].id;

      // Search for TEI
      const teiResponse = await fetch(
        `${this.baseUrl}/api/trackedEntityInstances.json?ou=${orgUnitId}&program=${config.dhis2.programId}&filter=${houseNumberAttributeId}:eq:${encodeURIComponent(houseNumber)}&fields=trackedEntityInstance,orgUnit,attributes[attribute,value,displayName]&paging=false`,
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!teiResponse.ok) {
        throw new Error(`Failed to search TEI: ${teiResponse.statusText}`);
      }

      const teiData = await teiResponse.json() as any;

      if (!teiData.trackedEntityInstances || teiData.trackedEntityInstances.length === 0) {
        return null;
      }

      const tei = teiData.trackedEntityInstances[0];

      // Save to cache - use house number as key
      await this.saveToCache('tei', houseNumber, tei);

      return tei;
    } catch (error) {
      console.error('Error searching for TEI:', error);
      throw error;
    }
  }

  /**
   * Get data elements for a program stage
   */
  async getProgramStageDataElements(): Promise<DataElement[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/programStages/${config.dhis2.programStageId}.json?fields=programStageDataElements[dataElement[id,displayName,valueType]]`,
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch program stage data elements: ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (!data.programStageDataElements) {
        return [];
      }

      return data.programStageDataElements.map((psde: any) => ({
        id: psde.dataElement.id,
        displayName: psde.dataElement.displayName,
        valueType: psde.dataElement.valueType,
      }));
    } catch (error) {
      console.error('Error fetching program stage data elements:', error);
      throw error;
    }
  }

  /**
   * Build a map of data element display names to IDs (with database caching)
   */
  async getDataElementMap(): Promise<Map<string, string>> {
    // Check cache first - use program stage ID as key
    const cached = await this.getFromCache<Array<[string, string]>>('dataElementMap', this.programStageId);
    if (cached) {
      return new Map(cached);
    }

    const dataElements = await this.getProgramStageDataElements();
    const map = new Map<string, string>();

    for (const de of dataElements) {
      map.set(de.displayName, de.id);
    }

    // Save to cache - convert Map to array for JSON serialization
    await this.saveToCache('dataElementMap', this.programStageId, Array.from(map.entries()));

    return map;
  }

  /**
   * Create or update an event for a tracked entity instance
   */
  async createEvent(event: Event): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/events`,
        {
          method: 'POST',
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Check if an event already exists for a TEI and date
   */
  async getExistingEvent(
    teiId: string,
    eventDate: string
  ): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/events.json?trackedEntityInstance=${teiId}&programStage=${config.dhis2.programStageId}&startDate=${eventDate}&endDate=${eventDate}&fields=event,eventDate,dataValues[dataElement,value]&paging=false`,
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch existing events: ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (!data.events || data.events.length === 0) {
        return null;
      }

      return data.events[0];
    } catch (error) {
      console.error('Error fetching existing event:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId: string, event: Partial<Event>): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update event: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }
}

export const dhis2Service = new DHIS2Service();

