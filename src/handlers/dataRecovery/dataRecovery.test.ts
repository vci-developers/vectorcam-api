import { UniqueConstraintError } from 'sequelize';
import { DataRecovery } from '../../db/models';
import { createDataRecovery } from './post';
import { getDataRecoveryList } from './getList';
import { updateDataRecovery } from './put';
import { deleteDataRecovery } from './delete';

jest.mock('../../db/models', () => ({
  DataRecovery: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

const mockedDataRecovery = DataRecovery as jest.Mocked<typeof DataRecovery>;

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

function buildRecord(overrides: Record<string, unknown> = {}) {
  const record: Record<string, unknown> = {
    id: 1,
    idempotencyKey: 'ghana-june-1',
    programId: 4,
    siteId: 9,
    sessionFrontendId: 'sess-1',
    year: 2024,
    month: 6,
    status: 'pending',
    notes: null,
    payload: { answers: [{ questionId: 1, value: 'missed' }] },
    createdAt: new Date('2024-06-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-15T00:00:00.000Z'),
    ...overrides,
  };
  record.update = jest.fn().mockImplementation(async (updates: Record<string, unknown>) => {
    Object.assign(record, updates);
    return record;
  });
  record.destroy = jest.fn().mockResolvedValue(undefined);
  return record;
}

describe('data recovery handlers', () => {
  it('stores a payload without checking related records', async () => {
    const record = buildRecord();
    mockedDataRecovery.create.mockResolvedValue(record as any);
    const reply = createReply();

    await createDataRecovery({
      body: {
        idempotencyKey: ' ghana-june-1 ',
        payload: record.payload,
        programId: 4,
        month: 6,
        year: 2024,
      },
      log: { error: jest.fn() },
    } as any, reply as any);

    expect(mockedDataRecovery.create).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'ghana-june-1',
      payload: record.payload,
      programId: 4,
      siteId: null,
      status: 'pending',
    }));
    expect(reply.code).toHaveBeenCalledWith(201);
  });

  it('returns the existing row when the idempotency key was already stored', async () => {
    const record = buildRecord();
    mockedDataRecovery.create.mockRejectedValue(new UniqueConstraintError({ message: 'duplicate' }));
    mockedDataRecovery.findOne.mockResolvedValue(record as any);
    const reply = createReply();

    await createDataRecovery({
      body: {
        idempotencyKey: 'ghana-june-1',
        payload: { answers: [] },
      },
      log: { error: jest.fn() },
    } as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      duplicate: true,
      dataRecovery: expect.objectContaining({ id: 1, payload: record.payload }),
    }));
  });

  it('lists records without loading payloads', async () => {
    const record = buildRecord();
    mockedDataRecovery.findAndCountAll.mockResolvedValue({ rows: [record], count: 1 } as any);
    const reply = createReply();

    await getDataRecoveryList({
      query: { programId: 4, month: 6, year: 2024, status: 'pending' },
      log: { error: jest.fn() },
    } as any, reply as any);

    expect(mockedDataRecovery.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { programId: 4, month: 6, year: 2024, status: 'pending' },
      attributes: { exclude: ['payload'] },
    }));
    const body = reply.send.mock.calls[0][0];
    expect(body.dataRecoveries[0].payload).toBeUndefined();
    expect(body.total).toBe(1);
  });

  it('updates status and notes only', async () => {
    const record = buildRecord();
    mockedDataRecovery.findByPk.mockResolvedValue(record as any);
    const reply = createReply();

    await updateDataRecovery({
      params: { id: 1 },
      body: { status: 'reconciled', notes: 'units remapped', payload: { ignored: true } },
      log: { error: jest.fn() },
    } as any, reply as any);

    expect(record.update).toHaveBeenCalledWith({ status: 'reconciled', notes: 'units remapped' });
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      dataRecovery: expect.objectContaining({
        status: 'reconciled',
        payload: record.payload,
      }),
    }));
  });

  it('deletes a recovery record', async () => {
    const record = buildRecord();
    mockedDataRecovery.findByPk.mockResolvedValue(record as any);
    const reply = createReply();

    await deleteDataRecovery({
      params: { id: 1 },
      log: { error: jest.fn() },
    } as any, reply as any);

    expect(record.destroy).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ message: 'Recovery record deleted' });
  });
});
