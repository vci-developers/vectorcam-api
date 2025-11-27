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
            malariaVectorDensity: { type: 'number' },
            fedAnophelesToPeopleSleptRatio: { type: 'number' },
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

    // 4. Get fed anopheles mosquitoes data
    // Count specimens that are anopheles (species partially matches 'anopheles') and have fed abdomen status
    const fedAnophelesQuery = `
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN si.abdomen_status IN ('Full fed') 
            AND si.species LIKE '%anopheles%'
          THEN sp.id 
        END) as totalFedAnopheles
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN specimens sp ON sess.id = sp.session_id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE s.district = :district
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sess.type = 'SURVEILLANCE'
    `;

    const fedAnophelesResult = await sequelize.query(fedAnophelesQuery, {
      replacements: { district, startDate, endDate },
      type: QueryTypes.SELECT
    }) as any[];

    const totalFedAnopheles = fedAnophelesResult[0]?.totalFedAnopheles || 0;

    // 5. Get malaria vector density: total anopheles / total mosquitoes (excluding non-mosquitoes)
    const malariaVectorDensityQuery = `
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN si.species LIKE '%anopheles%'
          THEN sp.id 
        END) as totalAnopheles,
        COUNT(DISTINCT CASE 
          WHEN si.species NOT LIKE '%non mosquito%'
            AND si.species IS NOT NULL
          THEN sp.id 
        END) as totalMosquitoes
      FROM sessions sess
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN specimens sp ON sess.id = sp.session_id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE s.district = :district
        AND sess.collection_date >= :startDate
        AND sess.collection_date < :endDate
        AND sess.type = 'SURVEILLANCE'
    `;

    const vectorDensityResult = await sequelize.query(malariaVectorDensityQuery, {
      replacements: { district, startDate, endDate },
      type: QueryTypes.SELECT
    }) as any[];

    const totalAnopheles = vectorDensityResult[0]?.totalAnopheles || 0;
    const totalMosquitoes = vectorDensityResult[0]?.totalMosquitoes || 0;

    // Calculate metrics
    let totalLlins = 0;
    let totalPeopleSleptUnderLlin = 0;

    // Process surveillance data
    surveillanceData.forEach(house => {
      // Total LLINs and people under LLINs
      if (house.num_llins_available !== null) {
        totalLlins += house.num_llins_available;
      }
      if (house.num_people_slept_under_llin !== null) {
        totalPeopleSleptUnderLlin += house.num_people_slept_under_llin;
      }
    });

    // Calculate final metrics
    // llinsPerPerson: total bednets / total people (no average)
    const llinsPerPerson = peopleInAllHousesInspected > 0 
      ? totalLlins / peopleInAllHousesInspected 
      : 0;

    // fedAnophelesToPeopleSleptRatio: total fed anopheles / total people under bednets (no average)
    const fedAnophelesToPeopleSleptRatio = totalPeopleSleptUnderLlin > 0 
      ? totalFedAnopheles / totalPeopleSleptUnderLlin 
      : 0;

    // malariaVectorDensity: total anopheles / total mosquitoes (excluding non-mosquitoes)
    const malariaVectorDensity = totalMosquitoes > 0 
      ? totalAnopheles / totalMosquitoes 
      : 0;

    const response = {
      siteInformation: {
        housesUsedForCollection,
        peopleInAllHousesInspected
      },
      entomologicalSummary: {
        malariaVectorDensity: Number(malariaVectorDensity.toFixed(2)),
        fedAnophelesToPeopleSleptRatio: Number(fedAnophelesToPeopleSleptRatio.toFixed(2)),
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

