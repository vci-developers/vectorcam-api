import { Session, SurveillanceForm } from '../db/models';
import { SpecimenCounts } from './dhis2-aggregation.service';
import { EventDataValue } from './dhis2.service';

/**
 * Mapping of DHIS2 data element display names
 * These are used to lookup the actual IDs from DHIS2 dynamically
 */
export const DHIS2_DATA_ELEMENT_NAMES = {
  // Session data
  COLLECTION_DATE: 'MAL 001-ER09. Date of Collection',
  COLLECTOR_TITLE: 'MAL 001-ER12.Title of officer',
  COLLECTOR_NAME: 'MAL 001-ER10.Name of officer',
  COLLECTION_METHOD: 'MAL 001-ER29 - Mosquito collection method (PSC/LTC*)',

  // Surveillance form data - Site level IRS
  SITE_SPRAYED_IN_PAST_12_MONTHS: 'MAL 001-ER06. Has site sprayed in the past 12 months?',
  INSECTICIDE_SPRAYED: 'MAL 001-ER07. Insecticide sprayed',
  DATE_LAST_SPRAYED: 'MAL 001-ER08. Date Last Sprayed',
  
  // Surveillance form data - House level
  NUM_PEOPLE_SLEPT: 'MAL 001-ER13. No. of people who slept in the house',
  HOUSE_SPRAYED: 'MAL 001-ER14. Has the house beeen sprayed before?',
  MONTHS_SINCE_IRS: 'MAL 001-ER15. How many months ago?',
  NUM_LLINS: 'MAL 001-ER16. Number of LLINs available',
  NUM_PEOPLE_UNDER_LLIN: 'MAL 001-ER30. No. of people who slept under LLIN',

  // LLIN types
  LLIN_TYPE_ANY: 'MAL 001-ER17. Type of LLIN',
  LLIN_TYPE_PYRETHROID: 'MAL 001-ER17a. A - Pyrethroid-only',
  LLIN_TYPE_PBO: 'MAL 001-ER17b.B - Pyrethroid + PBO',
  LLIN_TYPE_CHLORFENAPYR: 'MAL 001-ER17c.C - Pyrethroid + chlorfenapyr',
  LLIN_TYPE_PYRIPROXYFEN: 'MAL 001-ER17d.D - Pyrethroid + pyriproxyfen',
  LLIN_TYPE_OTHER: 'MAL 001-ER17e.E – Other',

  // LLIN brands
  LLIN_BRAND_ANY: 'MAL 001-ER28. Brand of LLIN',
  LLIN_BRAND_OLYSET: 'MAL 001-ER28a.1 - OLYSET Net',
  LLIN_BRAND_OLYSET_PLUS: 'MAL 001-ER28b.2 - OLYSET PLUS',
  LLIN_BRAND_INTERCEPTOR: 'MAL 001-ER28c.3 - Interceptor',
  LLIN_BRAND_INTERCEPTOR_G2: 'MAL 001-ER28d.4 - Interceptor G2',
  LLIN_BRAND_ROYAL_SENTRY: 'MAL 001-ER28e.5 - Royal Sentry',
  LLIN_BRAND_ROYAL_SENTRY_2: 'MAL 001-ER28f.6 - Royal Sentry 2.0',
  LLIN_BRAND_ROYAL_GUARD: 'MAL 001-ER28g.7 - Royal Guard',
  LLIN_BRAND_PERMANET_2: 'MAL 001-ER28h.8 - PermaNet 2.0',
  LLIN_BRAND_PERMANET_3: 'MAL 001-ER28i.9 - PermaNet 3.0',
  LLIN_BRAND_DURANET: 'MAL 001-ER28j.10 - Duranet LLIN',
  LLIN_BRAND_MIRANET: 'MAL 001-ER28k.11 - MiraNet',
  LLIN_BRAND_MAGNET: 'MAL 001-ER28l.12 - MAGNet',
  LLIN_BRAND_VEERALIN: 'MAL 001-ER28m.13 - VEERALIN',
  LLIN_BRAND_YAHE: 'MAL 001-ER28n.14 - Yahe LN',
  LLIN_BRAND_SAFENET: 'MAL 001-ER28o.15 - SafeNet',
  LLIN_BRAND_YORKOOL: 'MAL 001-ER28p.16 - Yorkool LN',
  LLIN_BRAND_PANDA_NET: 'MAL 001-ER28q.17 - Panda Net 2.0',
  LLIN_BRAND_TSARA_BOOST: 'MAL 001-ER28r.18 - Tsara Boost',
  LLIN_BRAND_TSARA_SOFT: 'MAL 001-ER28s.19 - Tsara Soft',
  LLIN_BRAND_TSARA_PLUS: 'MAL 001-ER28t.20 - Tsara Plus',
  LLIN_BRAND_OTHER: 'MAL 001-ER28u.21 - Other',

  // An. gambiae s.l.
  AN_GAMBIAE_ANY: 'MAL 001-ER18. An. gambiae s.l.',
  AN_GAMBIAE_FED: 'MAL 001-ER18a. An. gambiae s.l. - Fed',
  AN_GAMBIAE_UNFED: 'MAL 001-ER18b. An. gambiae s.l. - Unfed',
  AN_GAMBIAE_GRAVID: 'MAL 001-ER18c. An. gambiae s.l. - Gravid',
  AN_GAMBIAE_HALF_GRAVID: 'MAL 001-ER18d. An. gambiae s.l. - Half gravid',
  AN_GAMBIAE_NULLIPAROUS: 'MAL 001-ER18e. An. gambiae s.l. - Nulliparous(NP)',
  AN_GAMBIAE_PAROUS: 'MAL 001-ER18f. An. gambiae s.l. - Parous(P)',

  // An. funestus s.l.
  AN_FUNESTUS_ANY: 'MAL 001-ER19. An. funestus s.l.',
  AN_FUNESTUS_FED: 'MAL 001-ER19a. An. funestus s.l. - Fed',
  AN_FUNESTUS_UNFED: 'MAL 001-ER19b. An. funestus s.l. - Unfed',
  AN_FUNESTUS_GRAVID: 'MAL 001-ER19c. An. funestus s.l. - Gravid',
  AN_FUNESTUS_HALF_GRAVID: 'MAL 001-ER19d. An. funestus s.l. - Half gravid',
  AN_FUNESTUS_NULLIPAROUS: 'MAL 001-ER19e. An. funestus s.l. - Nulliparous(NP)',
  AN_FUNESTUS_PAROUS: 'MAL 001-ER19f. An. funestus s.l. - Parous(P)',

  // An. coustani s.l.
  AN_COUSTANI_ANY: 'MAL 001-ER20. An. coustani s.l.',
  AN_COUSTANI_FED: 'MAL 001-ER20a. An. coustani s.l. - Fed',
  AN_COUSTANI_UNFED: 'MAL 001-ER20b. An. coustani s.l. - Unfed',
  AN_COUSTANI_GRAVID: 'MAL 001-ER20c. An. coustani s.l. - Gravid',
  AN_COUSTANI_HALF_GRAVID: 'MAL 001-ER20d. An. coustani s.l. - Half gravid',
  AN_COUSTANI_NULLIPAROUS: 'MAL 001-ER20e. An. coustani s.l. - Nulliparous(NP)',
  AN_COUSTANI_PAROUS: 'MAL 001-ER20f. An. coustani s.l. - Parous(P)',

  // Other Anopheles
  AN_OTHER_ANY: 'MAL 001-ER21. Other Anopheles',
  AN_OTHER_FED: 'MAL 001-ER21a. Other Anopheles - Fed',
  AN_OTHER_UNFED: 'MAL 001-ER21b. Other Anopheles - Unfed',
  AN_OTHER_GRAVID: 'MAL 001-ER21c. Other Anopheles - Gravid',
  AN_OTHER_HALF_GRAVID: 'MAL 001-ER21d. Other Anopheles - Half gravid',
  AN_OTHER_NULLIPAROUS: 'MAL 001-ER21e. Other Anopheles - Nulliparous(NP)',
  AN_OTHER_PAROUS: 'MAL 001-ER21f. Other Anopheles - Parous(P)',

  // Male Anopheles
  MALE_ANOPHELES: 'MAL 001-ER25. Male Anopheles',

  // Culex
  CULEX_ANY: 'MAL 001-ER22. Culex',
  CULEX_FEMALE: 'MAL 001-ER22a. Culex - Female',
  CULEX_MALE: 'MAL 001-ER22b. Culex - Male',

  // Aedes
  AEDES_ANY: 'MAL 001-ER23. Aedes',
  AEDES_FEMALE: 'MAL 001-ER23a. Aedes- Female',
  AEDES_MALE: 'MAL 001-ER23b. Aedes- Male',

  // Other Culicines
  OTHER_CULICINES_ANY: 'MAL 001-ER24. Other Culicines',
  OTHER_CULICINES_FEMALE: 'MAL 001-ER24a. Other Culicines - Female',
  OTHER_CULICINES_MALE: 'MAL 001-ER24b. Other Culicines - Male',
};

export interface IrsOverrideData {
  wasIrsSprayed?: boolean;
  insecticideSprayed?: string;
  dateLastSprayed?: string;
}

class DHIS2MappingService {
  /**
   * Map VectorCam data to DHIS2 data values using dynamic data element IDs
   */
  mapToDataValues(
    session: Session,
    surveillanceForm: SurveillanceForm | null,
    specimenCounts: SpecimenCounts,
    dataElementMap: Map<string, string>,
    irsOverride?: IrsOverrideData
  ): EventDataValue[] {
    const dataValues: EventDataValue[] = [];

    // Map session data
    this.mapSessionData(session, dataValues, dataElementMap);

    // Map IRS data (site-level) - use override if provided, otherwise fall back to surveillanceForm
    if (irsOverride && irsOverride.wasIrsSprayed !== undefined) {
      // Use provided IRS data
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.SITE_SPRAYED_IN_PAST_12_MONTHS, irsOverride.wasIrsSprayed, dataElementMap);
      
      if (irsOverride.insecticideSprayed) {
        this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.INSECTICIDE_SPRAYED, irsOverride.insecticideSprayed, dataElementMap);
      }
      
      if (irsOverride.dateLastSprayed) {
        this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.DATE_LAST_SPRAYED, irsOverride.dateLastSprayed, dataElementMap);
      }
    } else {
      // Fall back to computing from surveillanceForm (existing behavior)
      let siteSprayedInPast12Months = false;
      if (surveillanceForm && surveillanceForm.wasIrsConducted !== null && surveillanceForm.monthsSinceIrs !== null) {
        siteSprayedInPast12Months = surveillanceForm.wasIrsConducted && surveillanceForm.monthsSinceIrs <= 12;
      }
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.SITE_SPRAYED_IN_PAST_12_MONTHS, siteSprayedInPast12Months, dataElementMap);
    }

    // Map surveillance form data
    if (surveillanceForm) {
      this.mapSurveillanceFormData(surveillanceForm, dataValues, dataElementMap);
    }

    // Map specimen counts
    this.mapSpecimenCounts(specimenCounts, dataValues, dataElementMap);

    return dataValues;
  }

  /**
   * Helper function to add data value if data element exists
   */
  private addDataValue(
    dataValues: EventDataValue[],
    displayName: string,
    value: string | number | boolean,
    dataElementMap: Map<string, string>
  ): void {
    const dataElementId = dataElementMap.get(displayName);
    if (dataElementId) {
      dataValues.push({
        dataElement: dataElementId,
        value,
      });
    }
  }

  /**
   * Map session data to DHIS2 data values
   */
  private mapSessionData(
    session: Session,
    dataValues: EventDataValue[],
    dataElementMap: Map<string, string>
  ): void {
    // Collection date (convert Date to string format YYYY-MM-DD)
    if (session.collectionDate) {
      const date = new Date(session.collectionDate);
      const dateString = date.toISOString().split('T')[0];
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.COLLECTION_DATE, dateString, dataElementMap);
    }

    // Collector title
    if (session.collectorTitle) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.COLLECTOR_TITLE, session.collectorTitle, dataElementMap);
    }

    // Collector name
    if (session.collectorName) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.COLLECTOR_NAME, session.collectorName, dataElementMap);
    }

    // Collection method - map to option code
    if (session.collectionMethod) {
      const collectionMethodCode = this.mapCollectionMethodToCode(session.collectionMethod);
      if (collectionMethodCode) {
        this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.COLLECTION_METHOD, collectionMethodCode, dataElementMap);
      }
    }
  }

  /**
   * Map collection method display text to DHIS2 option code
   */
  private mapCollectionMethodToCode(collectionMethod: string): string | null {
    const method = collectionMethod.toLowerCase().trim();
    
    // Extract code from parentheses if present (e.g., "Human Landing Catch (HLC)" -> "HLC")
    const codeMatch = method.match(/\(([^)]+)\)/);
    if (codeMatch) {
      return codeMatch[1].toUpperCase();
    }
    
    // Direct mapping for common values
    const methodMap: { [key: string]: string } = {
      'hlc': 'HLC',
      'human landing catch': 'HLC',
      'psc': 'PSC',
      'pyrethrum spray catch': 'PSC',
      'ltc': 'LTC',
      'light trap catch': 'LTC',
      'cdc light trap': 'LTC',
    };
    
    return methodMap[method] || null;
  }

  /**
   * Map surveillance form data to DHIS2 data values
   */
  private mapSurveillanceFormData(
    surveillanceForm: SurveillanceForm,
    dataValues: EventDataValue[],
    dataElementMap: Map<string, string>
  ): void {
    // Note: Site sprayed field is handled in mapToDataValues() to ensure it's always present
    
    // Number of people who slept in the house
    if (surveillanceForm.numPeopleSleptInHouse !== null) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.NUM_PEOPLE_SLEPT, surveillanceForm.numPeopleSleptInHouse, dataElementMap);
    }

    // Has the house been sprayed (IRS)
    if (surveillanceForm.wasIrsConducted !== null) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.HOUSE_SPRAYED, surveillanceForm.wasIrsConducted, dataElementMap);
    }

    // Months since IRS
    if (surveillanceForm.monthsSinceIrs !== null) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.MONTHS_SINCE_IRS, surveillanceForm.monthsSinceIrs, dataElementMap);
    }

    // Number of LLINs available
    if (surveillanceForm.numLlinsAvailable !== null) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.NUM_LLINS, surveillanceForm.numLlinsAvailable, dataElementMap);
    }

    // Number of people who slept under LLIN
    if (surveillanceForm.numPeopleSleptUnderLlin !== null) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.NUM_PEOPLE_UNDER_LLIN, surveillanceForm.numPeopleSleptUnderLlin, dataElementMap);
    }

    // LLIN type mapping
    this.mapLlinTypes(surveillanceForm, dataValues, dataElementMap);

    // LLIN brand mapping
    this.mapLlinBrands(surveillanceForm, dataValues, dataElementMap);
  }

  /**
   * Map LLIN types
   */
  private mapLlinTypes(
    surveillanceForm: SurveillanceForm,
    dataValues: EventDataValue[],
    dataElementMap: Map<string, string>
  ): void {
    const llinType = surveillanceForm.llinType?.toLowerCase() || '';

    if (llinType) {
      // At least one type was used
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_ANY, true, dataElementMap);

      // Map specific types
      const typeMapping: { [key: string]: string } = {
        'pyrethroid-only': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PYRETHROID,
        'pyrethroid only': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PYRETHROID,
        'pyrethroid + pbo': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PBO,
        'pyrethroid pbo': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PBO,
        'pyrethroid + chlorfenapyr': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_CHLORFENAPYR,
        'pyrethroid chlorfenapyr': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_CHLORFENAPYR,
        'pyrethroid + pyriproxyfen': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PYRIPROXYFEN,
        'pyrethroid pyriproxyfen': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_PYRIPROXYFEN,
        'other': DHIS2_DATA_ELEMENT_NAMES.LLIN_TYPE_OTHER,
      };

      for (const [key, displayName] of Object.entries(typeMapping)) {
        if (llinType.includes(key)) {
          this.addDataValue(dataValues, displayName, true, dataElementMap);
        }
      }
    }
  }

  /**
   * Map LLIN brands
   */
  private mapLlinBrands(
    surveillanceForm: SurveillanceForm,
    dataValues: EventDataValue[],
    dataElementMap: Map<string, string>
  ): void {
    const llinBrand = surveillanceForm.llinBrand?.toLowerCase() || '';

    if (llinBrand) {
      // At least one brand was used
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_ANY, true, dataElementMap);

      // Map specific brands
      const brandMapping: { [key: string]: string } = {
        'olyset plus': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_OLYSET_PLUS,
        'olyset': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_OLYSET,
        'interceptor g2': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_INTERCEPTOR_G2,
        'interceptor': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_INTERCEPTOR,
        'royal sentry 2.0': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_ROYAL_SENTRY_2,
        'royal sentry': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_ROYAL_SENTRY,
        'royal guard': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_ROYAL_GUARD,
        'permanet 3.0': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_PERMANET_3,
        'permanet 2.0': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_PERMANET_2,
        'duranet': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_DURANET,
        'miranet': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_MIRANET,
        'magnet': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_MAGNET,
        'veeralin': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_VEERALIN,
        'yahe': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_YAHE,
        'safenet': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_SAFENET,
        'yorkool': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_YORKOOL,
        'panda net': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_PANDA_NET,
        'tsara boost': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_TSARA_BOOST,
        'tsara soft': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_TSARA_SOFT,
        'tsara plus': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_TSARA_PLUS,
        'other': DHIS2_DATA_ELEMENT_NAMES.LLIN_BRAND_OTHER,
      };

      // Check for exact matches first (like "olyset plus" before "olyset")
      const sortedBrands = Object.entries(brandMapping).sort((a, b) => b[0].length - a[0].length);
      
      for (const [key, displayName] of sortedBrands) {
        if (llinBrand.includes(key)) {
          this.addDataValue(dataValues, displayName, true, dataElementMap);
          break; // Only match one brand to avoid duplicate matching
        }
      }
    }
  }

  /**
   * Map specimen counts to DHIS2 data values
   */
  private mapSpecimenCounts(
    counts: SpecimenCounts,
    dataValues: EventDataValue[],
    dataElementMap: Map<string, string>
  ): void {
    // An. gambiae s.l.
    if (counts.an_gambiae_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_GAMBIAE_ANY, true, dataElementMap);
    }
    if (counts.an_gambiae_fed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_GAMBIAE_FED, counts.an_gambiae_fed, dataElementMap);
    }
    if (counts.an_gambiae_unfed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_GAMBIAE_UNFED, counts.an_gambiae_unfed, dataElementMap);
    }
    if (counts.an_gambiae_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_GAMBIAE_GRAVID, counts.an_gambiae_gravid, dataElementMap);
    }
    if (counts.an_gambiae_half_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_GAMBIAE_HALF_GRAVID, counts.an_gambiae_half_gravid, dataElementMap);
    }

    // An. funestus s.l.
    if (counts.an_funestus_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_FUNESTUS_ANY, true, dataElementMap);
    }
    if (counts.an_funestus_fed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_FUNESTUS_FED, counts.an_funestus_fed, dataElementMap);
    }
    if (counts.an_funestus_unfed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_FUNESTUS_UNFED, counts.an_funestus_unfed, dataElementMap);
    }
    if (counts.an_funestus_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_FUNESTUS_GRAVID, counts.an_funestus_gravid, dataElementMap);
    }
    if (counts.an_funestus_half_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_FUNESTUS_HALF_GRAVID, counts.an_funestus_half_gravid, dataElementMap);
    }

    // Other Anopheles
    if (counts.an_other_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_OTHER_ANY, true, dataElementMap);
    }
    if (counts.an_other_fed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_OTHER_FED, counts.an_other_fed, dataElementMap);
    }
    if (counts.an_other_unfed > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_OTHER_UNFED, counts.an_other_unfed, dataElementMap);
    }
    if (counts.an_other_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_OTHER_GRAVID, counts.an_other_gravid, dataElementMap);
    }
    if (counts.an_other_half_gravid > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AN_OTHER_HALF_GRAVID, counts.an_other_half_gravid, dataElementMap);
    }

    // Male Anopheles (all species)
    if (counts.male_anopheles > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.MALE_ANOPHELES, counts.male_anopheles, dataElementMap);
    }

    // Culex
    if (counts.culex_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.CULEX_ANY, true, dataElementMap);
    }
    if (counts.culex_female > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.CULEX_FEMALE, counts.culex_female, dataElementMap);
    }
    if (counts.culex_male > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.CULEX_MALE, counts.culex_male, dataElementMap);
    }

    // Aedes
    if (counts.aedes_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AEDES_ANY, true, dataElementMap);
    }
    if (counts.aedes_female > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AEDES_FEMALE, counts.aedes_female, dataElementMap);
    }
    if (counts.aedes_male > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.AEDES_MALE, counts.aedes_male, dataElementMap);
    }

    // Other Culicines
    if (counts.other_culicines_total) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.OTHER_CULICINES_ANY, true, dataElementMap);
    }
    if (counts.other_culicines_female > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.OTHER_CULICINES_FEMALE, counts.other_culicines_female, dataElementMap);
    }
    if (counts.other_culicines_male > 0) {
      this.addDataValue(dataValues, DHIS2_DATA_ELEMENT_NAMES.OTHER_CULICINES_MALE, counts.other_culicines_male, dataElementMap);
    }
  }
}

export const dhis2MappingService = new DHIS2MappingService();
