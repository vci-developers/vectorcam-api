import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../../db';

interface RegisterHealthCenterRequest {
  latitude: number;
  longitude: number;
  parish: string;
  subcounty: string;
  district: string;
  country: string;
}

interface UpdateHealthCenterRequest {
  latitude?: number;
  longitude?: number;
  parish?: string;
  subcounty?: string;
  district?: string;
  country?: string;
}

export async function registerHealthCenter(
  request: FastifyRequest<{ Body: RegisterHealthCenterRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { latitude, longitude, parish, subcounty, district, country } = request.body;

    // Generate a unique health center ID with 'HC' prefix
    const healthCenterId = `HC${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create the health center
    const healthCenter = await models.HealthCenter.create({
      id: healthCenterId,
      latitude,
      longitude,
      parish,
      subcounty,
      district,
      country,
    });

    reply.code(201).send({
      message: 'Health center registered successfully',
      healthCenter: {
        healthCenterId: healthCenter.id,
        latitude: healthCenter.latitude,
        longitude: healthCenter.longitude,
        parish: healthCenter.parish,
        subcounty: healthCenter.subcounty,
        district: healthCenter.district,
        country: healthCenter.country,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to register health center' });
  }
}

export async function getHealthCenterDetails(
  request: FastifyRequest<{ Params: { healthcenter_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;

    const healthCenter = await models.HealthCenter.findByPk(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    reply.send({
      healthCenterId: healthCenter.id,
      latitude: healthCenter.latitude,
      longitude: healthCenter.longitude,
      parish: healthCenter.parish,
      subcounty: healthCenter.subcounty,
      district: healthCenter.district,
      country: healthCenter.country,
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get health center details' });
  }
}

export async function updateHealthCenter(
  request: FastifyRequest<{ Params: { healthcenter_id: string }; Body: UpdateHealthCenterRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;
    const { latitude, longitude, parish, subcounty, district, country } = request.body;

    const healthCenter = await models.HealthCenter.findByPk(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Update the health center
    await healthCenter.update({
      latitude: latitude !== undefined ? latitude : healthCenter.latitude,
      longitude: longitude !== undefined ? longitude : healthCenter.longitude,
      parish: parish !== undefined ? parish : healthCenter.parish,
      subcounty: subcounty !== undefined ? subcounty : healthCenter.subcounty,
      district: district !== undefined ? district : healthCenter.district,
      country: country !== undefined ? country : healthCenter.country,
    });

    reply.send({
      message: 'Health center updated successfully',
      healthCenter: {
        healthCenterId: healthCenter.id,
        latitude: healthCenter.latitude,
        longitude: healthCenter.longitude,
        parish: healthCenter.parish,
        subcounty: healthCenter.subcounty,
        district: healthCenter.district,
        country: healthCenter.country,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to update health center' });
  }
}

export async function deleteHealthCenter(
  request: FastifyRequest<{ Params: { healthcenter_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;

    const healthCenter = await models.HealthCenter.findByPk(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Check if health center is in use with sites
    const sitesCount = await models.Site.count({ where: { healthCenterId: healthcenter_id } });
    if (sitesCount > 0) {
      return reply.code(400).send({ 
        error: 'Health center cannot be deleted because it has associated sites' 
      });
    }

    // Delete the health center
    await healthCenter.destroy();

    reply.send({
      message: 'Health center deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to delete health center' });
  }
} 