import { FastifyRequest, FastifyReply } from 'fastify';
import { QueryTypes } from 'sequelize';
import sequelize from '../../db/index';
import { Site, Session, SurveillanceForm, Specimen, SpecimenImage, Annotation } from '../../db/models';
import { handleError } from './common';

interface MetricsQuery {
  district: string;
  startDate: string;
  endDate: string;
}

interface MetricsRequest extends FastifyRequest {
  Querystring: MetricsQuery;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Get all metrics for a specific district and date range in one API call',
  querystring: {
    type: 'object',
    properties: {
      district: { type: 'string' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' }
    },
    required: ['district', 'startDate', 'endDate']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        siteInformation: {
          type: 'object',
          properties: {
            housesUsedForCollection: { type: 'number' },
            peopleInAllHousesInspected: { type: 'number' }
          }
        },
        entomologicalSummary: {
          type: 'object',
          properties: {
            vectorDensity: { type: 'number' },
            fedMosquitoesToPeopleSleptRatio: { type: 'number' },
            totalLlins: { type: 'number' },
            totalPeopleSleptUnderLlin: { type: 'number' },
            llinsPerPerson: { type: 'number' }
          }
        }
      }
    }
  }
};

export async function getMetrics(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = request.query as MetricsQuery;
    const { district, startDate: startDateStr, endDate: endDateStr } = query;

    // Parse date strings to Date objects
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return reply.code(400).send({ error: 'Invalid date format. Use YYYY-MM-DD format.' });
    }

    if (startDate >= endDate) {
      return reply.code(400).send({ error: 'startDate must be before endDate' });
    }

    // 1. Get housesUsedForCollection: Total number of active houses in the district
    const housesUsedForCollection = await Site.count({
      where: {
        district,
        isActive: true
      }
    });

    // 2. Get peopleInAllHousesInspected: Sum of numPeopleSleptInHouse for unique houses
    // We need to get unique sites that had sessions in that month and sum their people count
    // Use a subquery with GROUP BY to get one row per site (not DISTINCT ON which is PostgreSQL-specific)
    const peopleInHousesQuery = `
      SELECT COALESCE(SUM(num_people_slept_in_house), 0) as totalPeople
      FROM (
        SELECT 
          sess.site_id,
          MAX(sf.num_people_slept_in_house) as num_people_slept_in_house
        FROM sessions sess
        INNER JOIN sites s ON sess.site_id = s.id
        LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
        WHERE s.district = :district
          AND sess.collection_date >= :startDate
          AND sess.collection_date < :endDate
          AND sf.num_people_slept_in_house IS NOT NULL
        GROUP BY sess.site_id
      ) as unique_houses
    `;

    const peopleResult = await sequelize.query(peopleInHousesQuery, {
      replacements: { district, startDate, endDate },
      type: QueryTypes.SELECT
    }) as any[];

    const peopleInAllHousesInspected = peopleResult[0]?.totalPeople || 0;

    // Calculate number of days in the date range
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);

    // 3. Get surveillance forms data for the district and date range
    // We need data per house (per site) to calculate averages
    const surveillanceDataQuery = `
      SELECT 
        sess.site_id,
        sf.num_people_slept_in_house,
        sf.num_llins_available,
        sf.num_people_slept_under_llin,
        COUNT(DISTINCT sp.id) as totalSpecimens
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
      LEFT JOIN specimens sp ON sess.id = sp.session_id
      WHERE s.district = :district
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sess.type = 'SURVEILLANCE'
      GROUP BY sess.site_id, sf.num_people_slept_in_house, 
               sf.num_llins_available, sf.num_people_slept_under_llin
    `;

    const surveillanceData = await sequelize.query(surveillanceDataQuery, {
      replacements: { district, startDate, endDate },
      type: QueryTypes.SELECT
    }) as any[];

    // 4. Get fed mosquitoes data (where abdomen status indicates "fed")
    // Fed status can be determined from visualAbdomenStatus or morphAbdomenStatus in annotations
    // or from abdomenStatus in specimen images (thumbnail)
    const fedMosquitoesQuery = `
      SELECT 
        sess.site_id,
        sf.num_people_slept_in_house,
        COUNT(DISTINCT CASE 
          WHEN si.abdomen_status IN ('Fed', 'Blood-fed', 'fed', 'blood-fed') 
          THEN sp.id 
        END) as fedCount
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN surveillanceforms sf ON sess.id = sf.session_id
      LEFT JOIN specimens sp ON sess.id = sp.session_id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE s.district = :district
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sess.type = 'SURVEILLANCE'
      GROUP BY sess.id, sess.site_id, sf.num_people_slept_in_house
    `;

    const fedMosquitoesData = await sequelize.query(fedMosquitoesQuery, {
      replacements: { district, startDate, endDate },
      type: QueryTypes.SELECT
    }) as any[];

    // Calculate metrics
    let totalLlins = 0;
    let totalPeopleSleptUnderLlin = 0;
    let vectorDensitySum = 0;
    let vectorDensityCount = 0;
    let llinsPerPersonSum = 0;
    let llinsPerPersonCount = 0;
    let fedRatioSum = 0;
    let fedRatioCount = 0;

    // Process surveillance data
    surveillanceData.forEach(house => {
      // Total LLINs and people under LLINs
      if (house.num_llins_available !== null) {
        totalLlins += house.num_llins_available;
      }
      if (house.num_people_slept_under_llin !== null) {
        totalPeopleSleptUnderLlin += house.num_people_slept_under_llin;
      }

      // Vector Density: number of mosquitoes per house per day
      // Calculate as: total specimens collected from house / number of days in the date range
      if (daysDiff > 0) {
        const vectorDensity = house.totalSpecimens / daysDiff;
        vectorDensitySum += vectorDensity;
        vectorDensityCount++;
      }

      // LLINs per person: LLINs / people in house (per house, then averaged)
      if (house.num_llins_available !== null && 
          house.num_people_slept_in_house && 
          house.num_people_slept_in_house > 0) {
        const llinsPerPerson = house.num_llins_available / house.num_people_slept_in_house;
        llinsPerPersonSum += llinsPerPerson;
        llinsPerPersonCount++;
      }
    });

    // Process fed mosquitoes data
    fedMosquitoesData.forEach(house => {
      // Fed mosquitoes to people slept ratio (per house, then averaged)
      if (house.num_people_slept_in_house && house.num_people_slept_in_house > 0) {
        const fedRatio = house.fedCount / house.num_people_slept_in_house;
        fedRatioSum += fedRatio;
        fedRatioCount++;
      }
    });

    // Calculate averages
    const vectorDensity = vectorDensityCount > 0 ? vectorDensitySum / vectorDensityCount : 0;
    const fedMosquitoesToPeopleSleptRatio = fedRatioCount > 0 ? fedRatioSum / fedRatioCount : 0;
    const llinsPerPerson = llinsPerPersonCount > 0 ? llinsPerPersonSum / llinsPerPersonCount : 0;

    const response = {
      siteInformation: {
        housesUsedForCollection,
        peopleInAllHousesInspected
      },
      entomologicalSummary: {
        vectorDensity: Number(vectorDensity.toFixed(2)),
        fedMosquitoesToPeopleSleptRatio: Number(fedMosquitoesToPeopleSleptRatio.toFixed(2)),
        totalLlins,
        totalPeopleSleptUnderLlin,
        llinsPerPerson: Number(llinsPerPerson.toFixed(2))
      }
    };

    return reply.send(response);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session metrics');
  }
}

