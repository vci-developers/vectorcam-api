import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../../db';

interface RegisterDeviceRequest {
  siteId: string;
}

interface UpdateDeviceRequest {
  siteId: string;
}

export async function registerDevice(
  request: FastifyRequest<{ Body: RegisterDeviceRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { siteId } = request.body;

    // Check if site exists
    const site = await models.Site.findByPk(siteId);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Generate a unique device ID with 'DEV' prefix
    const deviceId = `DEV${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create the device
    const device = await models.Device.create({
      id: deviceId,
      siteId,
    });

    reply.code(201).send({
      message: 'Device registered successfully',
      device: {
        deviceId: device.id,
        siteId: device.siteId,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to register device' });
  }
}

export async function getDeviceDetails(
  request: FastifyRequest<{ Params: { device_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;

    const device = await models.Device.findByPk(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    reply.send({
      deviceId: device.id,
      siteId: device.siteId,
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get device details' });
  }
}

export async function updateDevice(
  request: FastifyRequest<{ Params: { device_id: string }; Body: UpdateDeviceRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;
    const { siteId } = request.body;

    const device = await models.Device.findByPk(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Check if site exists when updating siteId
    if (siteId) {
      const site = await models.Site.findByPk(siteId);
      if (!site) {
        return reply.code(404).send({ error: 'Site not found' });
      }
    }

    // Update the device
    await device.update({ siteId });

    reply.send({
      message: 'Device updated successfully',
      device: {
        deviceId: device.id,
        siteId: device.siteId,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to update device' });
  }
}

export async function deleteDevice(
  request: FastifyRequest<{ Params: { device_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;

    const device = await models.Device.findByPk(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Delete the device
    await device.destroy();

    reply.send({
      message: 'Device deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to delete device' });
  }
} 