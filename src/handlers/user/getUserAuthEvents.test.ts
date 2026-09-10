import { Op } from 'sequelize';
import { getUserAuthEventsHandler } from './getUserAuthEvents';
import { User, UserAuthEvent } from '../../db/models';
import { queryUserLoginActivity } from './userLoginActivity';

jest.mock('../../db/models', () => ({
  User: {
    findAll: jest.fn(),
  },
  UserAuthEvent: {
    findAndCountAll: jest.fn(),
  },
}));

jest.mock('./userLoginActivity', () => ({
  queryUserLoginActivity: jest.fn(),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getUserAuthEventsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes aggregated users for the full date range when startDate and endDate are provided', async () => {
    (User.findAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (UserAuthEvent.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [],
      count: 0,
    });
    (queryUserLoginActivity as jest.Mock).mockResolvedValue([
      {
        userId: 1,
        email: 'alpha@example.com',
        name: 'Alpha',
        totalLogins: 3,
        dailyLogins: [
          { date: '2026-09-01', count: 2 },
          { date: '2026-09-02', count: 1 },
        ],
      },
    ]);

    const request: any = {
      query: {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        programId: 3,
        eventType: 'login',
      },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getUserAuthEventsHandler(request, reply as any);

    expect(queryUserLoginActivity).toHaveBeenCalledWith({
      startAt: new Date('2026-09-01T00:00:00.000Z'),
      endAt: new Date('2026-09-30T23:59:59.999Z'),
      programId: 3,
      userId: undefined,
    });

    expect(UserAuthEvent.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: 'login',
          createdAt: {
            [Op.gte]: new Date('2026-09-01T00:00:00.000Z'),
            [Op.lte]: new Date('2026-09-30T23:59:59.999Z'),
          },
        }),
      })
    );

    expect(reply.send).toHaveBeenCalledWith({
      message: 'User auth events retrieved successfully',
      distinctUserCount: 1,
      users: [
        {
          userId: 1,
          email: 'alpha@example.com',
          name: 'Alpha',
          totalLogins: 3,
          dailyLogins: [
            { date: '2026-09-01', count: 2 },
            { date: '2026-09-02', count: 1 },
          ],
        },
      ],
      events: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  });

  it('does not paginate users when events are paginated', async () => {
    (UserAuthEvent.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{
        id: 99,
        userId: 1,
        eventType: 'login',
        ipAddress: null,
        userAgent: null,
        metadata: null,
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
        updatedAt: new Date('2026-09-01T12:00:00.000Z'),
      }],
      count: 200,
    });
    (queryUserLoginActivity as jest.Mock).mockResolvedValue([
      { userId: 1, email: 'a@example.com', name: 'A', totalLogins: 1, dailyLogins: [{ date: '2026-09-01', count: 1 }] },
      { userId: 2, email: 'b@example.com', name: 'B', totalLogins: 1, dailyLogins: [{ date: '2026-09-01', count: 1 }] },
    ]);

    const request: any = {
      query: {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        limit: 1,
        offset: 10,
      },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getUserAuthEventsHandler(request, reply as any);

    expect(UserAuthEvent.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1, offset: 10 })
    );
    expect(queryUserLoginActivity).toHaveBeenCalledTimes(1);
    const payload = (reply.send as jest.Mock).mock.calls[0][0];
    expect(payload.distinctUserCount).toBe(2);
    expect(payload.users).toHaveLength(2);
    expect(payload.limit).toBe(1);
    expect(payload.offset).toBe(10);
    expect(payload.total).toBe(200);
    expect(payload.hasMore).toBe(true);
  });

  it('returns empty users when startDate or endDate is missing', async () => {
    (UserAuthEvent.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [],
      count: 0,
    });

    const request: any = {
      query: { startDate: '2026-09-01' },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getUserAuthEventsHandler(request, reply as any);

    expect(queryUserLoginActivity).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctUserCount: 0,
        users: [],
      })
    );
  });
});
