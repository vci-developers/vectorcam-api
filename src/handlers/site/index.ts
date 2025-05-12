import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../../db';

interface RegisterSiteRequest {
  healthCenterId: string;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

interface UpdateSiteRequest {
  healthCenterId?: string;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

export async function registerSite(
  request: FastifyRequest<{ Body: RegisterSiteRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthCenterId, latitude, longitude, houseNumber, villageName } = request.body;

    // Check if health center exists
    const healthCenter = await models.HealthCenter.findByPk(healthCenterId);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Generate a unique site ID with 'SITE' prefix
    const siteId = `SITE${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create the site
    const site = await models.Site.create({
      id: siteId,
      healthCenterId,
      latitude,
      longitude,
      houseNumber,
      villageName,
    });

    reply.code(201).send({
      message: 'Site registered successfully',
      site: {
        siteId: site.id,
        healthCenterId: site.healthCenterId,
        latitude: site.latitude,
        longitude: site.longitude,
        houseNumber: site.houseNumber,
        villageName: site.villageName,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to register site' });
  }
}

export async function getSiteDetails(
  request: FastifyRequest<{ Params: { site_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    const site = await models.Site.findByPk(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    reply.send({
      siteId: site.id,
      healthCenterId: site.healthCenterId,
      latitude: site.latitude,
      longitude: site.longitude,
      houseNumber: site.houseNumber,
      villageName: site.villageName,
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get site details' });
  }
}

export async function updateSite(
  request: FastifyRequest<{ Params: { site_id: string }; Body: UpdateSiteRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;
    const { healthCenterId, latitude, longitude, houseNumber, villageName } = request.body;

    const site = await models.Site.findByPk(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Check if health center exists when updating healthCenterId
    if (healthCenterId) {
      const healthCenter = await models.HealthCenter.findByPk(healthCenterId);
      if (!healthCenter) {
        return reply.code(404).send({ error: 'Health center not found' });
      }
    }

    // Update the site
    await site.update({
      healthCenterId: healthCenterId || site.healthCenterId,
      latitude: latitude !== undefined ? latitude : site.latitude,
      longitude: longitude !== undefined ? longitude : site.longitude,
      houseNumber: houseNumber !== undefined ? houseNumber : site.houseNumber,
      villageName: villageName !== undefined ? villageName : site.villageName,
    });

    reply.send({
      message: 'Site updated successfully',
      site: {
        siteId: site.id,
        healthCenterId: site.healthCenterId,
        latitude: site.latitude,
        longitude: site.longitude,
        houseNumber: site.houseNumber,
        villageName: site.villageName,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to update site' });
  }
}

export async function deleteSite(
  request: FastifyRequest<{ Params: { site_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    const site = await models.Site.findByPk(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Delete the site
    await site.destroy();

    reply.send({
      message: 'Site deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to delete site' });
  }
} 