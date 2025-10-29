import { Specimen, SpecimenImage, Session, Site, SurveillanceForm } from '../db/models';
import { Op } from 'sequelize';

export interface SpecimenCounts {
  // An. gambiae s.l.
  'an_gambiae_fed': number;
  'an_gambiae_unfed': number;
  'an_gambiae_gravid': number;
  'an_gambiae_half_gravid': number;
  'an_gambiae_total': boolean;

  // An. funestus s.l.
  'an_funestus_fed': number;
  'an_funestus_unfed': number;
  'an_funestus_gravid': number;
  'an_funestus_half_gravid': number;
  'an_funestus_total': boolean;

  // Other Anopheles
  'an_other_fed': number;
  'an_other_unfed': number;
  'an_other_gravid': number;
  'an_other_half_gravid': number;
  'an_other_total': boolean;

  // Culex
  'culex_female': number;
  'culex_male': number;
  'culex_total': boolean;

  // Aedes
  'aedes_female': number;
  'aedes_male': number;
  'aedes_total': boolean;

  // Other Culicines
  'other_culicines_female': number;
  'other_culicines_male': number;
  'other_culicines_total': boolean;

  // Male Anopheles
  'male_anopheles': number;
}

export interface HouseholdData {
  siteId: number;
  site: Site;
  sessions: Session[];
  surveillanceForm: SurveillanceForm | null;
  specimenCounts: SpecimenCounts;
}

class DHIS2AggregationService {
  /**
   * Get all household data for a specific month
   * @param year - The year to query
   * @param month - The month to query (1-12)
   * @param allowedSiteIds - Optional array of site IDs to filter by. If null, no filter is applied.
   */
  async getHouseholdDataByMonth(year: number, month: number, allowedSiteIds: number[] | null = null): Promise<HouseholdData[]> {
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Build where clause with optional site filter
    const whereClause: any = {
      collectionDate: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };

    // Add site filter if allowedSiteIds is provided
    if (allowedSiteIds !== null) {
      whereClause.siteId = {
        [Op.in]: allowedSiteIds,
      };
    }

    // Find all sessions in this month
    const sessions = await Session.findAll({
      where: whereClause,
      include: [
        {
          model: Site,
          as: 'site',
          required: true,
        },
        {
          model: Specimen,
          as: 'specimens',
          required: false,
        },
        {
          model: SurveillanceForm,
          as: 'surveillanceForm',
          required: false,
        },
      ],
      order: [['collectionDate', 'ASC']],
    });

    // Group sessions by site (household)
    const householdMap = new Map<number, HouseholdData>();

    for (const session of sessions) {
      const siteId = session.siteId;

      if (!householdMap.has(siteId)) {
        householdMap.set(siteId, {
          siteId,
          site: (session as any).site,
          sessions: [],
          surveillanceForm: null,
          specimenCounts: this.initializeSpecimenCounts(),
        });
      }

      const householdData = householdMap.get(siteId)!;
      householdData.sessions.push(session);

      // Use the most recent surveillance form for this household
      if ((session as any).surveillanceForm) {
        householdData.surveillanceForm = (session as any).surveillanceForm;
      }
    }

    // For each household, aggregate specimen counts
    for (const householdData of householdMap.values()) {
      const sessionIds = householdData.sessions.map(s => s.id);
      await this.aggregateSpecimenCounts(sessionIds, householdData.specimenCounts);
    }

    return Array.from(householdMap.values());
  }

  /**
   * Initialize specimen counts to zero
   */
  private initializeSpecimenCounts(): SpecimenCounts {
    return {
      an_gambiae_fed: 0,
      an_gambiae_unfed: 0,
      an_gambiae_gravid: 0,
      an_gambiae_half_gravid: 0,
      an_gambiae_total: false,

      an_funestus_fed: 0,
      an_funestus_unfed: 0,
      an_funestus_gravid: 0,
      an_funestus_half_gravid: 0,
      an_funestus_total: false,

      an_other_fed: 0,
      an_other_unfed: 0,
      an_other_gravid: 0,
      an_other_half_gravid: 0,
      an_other_total: false,

      culex_female: 0,
      culex_male: 0,
      culex_total: false,

      aedes_female: 0,
      aedes_male: 0,
      aedes_total: false,

      other_culicines_female: 0,
      other_culicines_male: 0,
      other_culicines_total: false,

      male_anopheles: 0,
    };
  }

  /**
   * Aggregate specimen counts for given session IDs
   */
  private async aggregateSpecimenCounts(
    sessionIds: number[],
    counts: SpecimenCounts
  ): Promise<void> {
    if (sessionIds.length === 0) return;

    // Get all specimens for these sessions
    const specimens = await Specimen.findAll({
      where: {
        sessionId: {
          [Op.in]: sessionIds,
        },
      },
      include: [
        {
          model: SpecimenImage,
          as: 'thumbnailImage',
          required: false,
        },
      ],
    });

    // Count specimens by species, sex, and abdomen status
    for (const specimen of specimens) {
      const thumbnailImage = (specimen as any).thumbnailImage as SpecimenImage | null;

      if (!thumbnailImage) continue;

      const species = thumbnailImage.species?.toLowerCase() || '';
      const sex = thumbnailImage.sex?.toLowerCase() || '';
      const abdomenStatus = thumbnailImage.abdomenStatus?.toLowerCase() || '';

      // An. gambiae s.l.
      if (species.includes('gambiae')) {
        counts.an_gambiae_total = true;
        
        if (sex === 'male') {
          counts.male_anopheles++;
        } else if (sex === 'female') {
          if (abdomenStatus.includes('fed') || abdomenStatus.includes('blood')) {
            counts.an_gambiae_fed++;
          } else if (abdomenStatus.includes('unfed') || abdomenStatus.includes('empty')) {
            counts.an_gambiae_unfed++;
          } else if (abdomenStatus.includes('gravid') && !abdomenStatus.includes('half')) {
            counts.an_gambiae_gravid++;
          } else if (abdomenStatus.includes('half') && abdomenStatus.includes('gravid')) {
            counts.an_gambiae_half_gravid++;
          }
        }
      }
      // An. funestus s.l.
      else if (species.includes('funestus')) {
        counts.an_funestus_total = true;
        
        if (sex === 'male') {
          counts.male_anopheles++;
        } else if (sex === 'female') {
          if (abdomenStatus.includes('fed') || abdomenStatus.includes('blood')) {
            counts.an_funestus_fed++;
          } else if (abdomenStatus.includes('unfed') || abdomenStatus.includes('empty')) {
            counts.an_funestus_unfed++;
          } else if (abdomenStatus.includes('gravid') && !abdomenStatus.includes('half')) {
            counts.an_funestus_gravid++;
          } else if (abdomenStatus.includes('half') && abdomenStatus.includes('gravid')) {
            counts.an_funestus_half_gravid++;
          }
        }
      }
      // Culex
      else if (species.includes('culex')) {
        counts.culex_total = true;
        
        if (sex === 'female') {
          counts.culex_female++;
        } else if (sex === 'male') {
          counts.culex_male++;
        }
      }
      // Aedes
      else if (species.includes('aedes')) {
        counts.aedes_total = true;
        
        if (sex === 'female') {
          counts.aedes_female++;
        } else if (sex === 'male') {
          counts.aedes_male++;
        }
      }
      // Other Culicines (Mansonia, etc.)
      else if (species.includes('mansonia') || species.includes('culicine')) {
        counts.other_culicines_total = true;
        
        if (sex === 'female') {
          counts.other_culicines_female++;
        } else if (sex === 'male') {
          counts.other_culicines_male++;
        }
      }
      // Other Anopheles
      else if (species.includes('anopheles')) {
        counts.an_other_total = true;
        
        if (sex === 'male') {
          counts.male_anopheles++;
        } else if (sex === 'female') {
          if (abdomenStatus.includes('fed') || abdomenStatus.includes('blood')) {
            counts.an_other_fed++;
          } else if (abdomenStatus.includes('unfed') || abdomenStatus.includes('empty')) {
            counts.an_other_unfed++;
          } else if (abdomenStatus.includes('gravid') && !abdomenStatus.includes('half')) {
            counts.an_other_gravid++;
          } else if (abdomenStatus.includes('half') && abdomenStatus.includes('gravid')) {
            counts.an_other_half_gravid++;
          }
        }
      }
    }
  }
}

export const dhis2AggregationService = new DHIS2AggregationService();

