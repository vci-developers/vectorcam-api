import { Op } from 'sequelize';
import sequelize from '../../db';
import createAnnotationTasks from './post';
import {
  Annotation,
  AnnotationTask,
  CollectionCycle,
  Program,
  Specimen,
  User,
} from '../../db/models';

jest.mock('../../db', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(),
    literal: jest.fn((sql: string) => ({ sql })),
  },
}));

jest.mock('../../db/models', () => ({
  Program: { findByPk: jest.fn() },
  CollectionCycle: { findByPk: jest.fn() },
  User: { findAll: jest.fn() },
  Specimen: { findAll: jest.fn() },
  AnnotationTask: {
    create: jest.fn(),
    findAll: jest.fn(),
  },
  Annotation: { bulkCreate: jest.fn() },
  Session: {},
  Site: {},
}));

jest.mock('./common', () => ({
  formatAnnotationTaskResponse: jest.fn((task) => ({
    id: task.id,
    annotatorId: task.userId,
    title: task.title,
    description: task.description,
    status: task.status,
    createdAt: task.createdAt?.getTime?.() ?? 0,
    updatedAt: task.updatedAt?.getTime?.() ?? 0,
  })),
}));

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    sent: false,
  };
}

function createRequest(body: Record<string, unknown>) {
  return {
    body,
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
}

function makeUser(id: number) {
  return {
    id,
    email: `admin${id}@example.com`,
    programId: 1,
    privilege: 4,
    isActive: true,
  };
}

function makeSpecimen(id: number) {
  return {
    id,
    session: {
      id: id * 10,
      collectionCycleId: 7,
      site: { id: 100, programId: 1 },
    },
  };
}

function setupSuccessfulLookup() {
  (Program.findByPk as jest.Mock).mockResolvedValue({ id: 1 });
  (CollectionCycle.findByPk as jest.Mock).mockResolvedValue({ id: 7, programId: 1 });
}

function mockTaskCreation(users: ReturnType<typeof makeUser>[]) {
  let taskId = 100;
  (AnnotationTask.create as jest.Mock).mockImplementation(async ({ userId }: { userId: number }) => {
    const task = {
      id: taskId++,
      userId,
      title: 'Annotation Task',
      description: 'desc',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    return task;
  });

  (AnnotationTask.findAll as jest.Mock).mockImplementation(async ({ where }: { where: { id: number[] } }) =>
    where.id.map((id, index) => ({
      id,
      userId: users[index]?.id ?? id,
      title: 'Annotation Task',
      description: 'desc',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      get: () => users[index],
    }))
  );
}

function getAnnotationsByUser(bulkCreateMock: jest.Mock) {
  const rows = bulkCreateMock.mock.calls[0]?.[0] ?? [];
  const grouped = new Map<number, number[]>();
  for (const row of rows) {
    const existing = grouped.get(row.annotatorId) ?? [];
    existing.push(row.specimenId);
    grouped.set(row.annotatorId, existing);
  }
  return grouped;
}

function getDuplicateAdminIds(specimenIndex: number, adminCount: number): number[] {
  return Array.from({ length: 3 }, (_, offset) => ((specimenIndex + offset) % adminCount) + 1);
}

function getExpectedBaseCounts(baseCount: number, adminCount: number): number[] {
  const basePerAdmin = Math.floor(baseCount / adminCount);
  const extraBaseCount = baseCount % adminCount;
  return Array.from({ length: adminCount }, (_, adminIndex) =>
    basePerAdmin + (adminIndex < extraBaseCount ? 1 : 0)
  );
}

describe('createAnnotationTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction);
    jest.spyOn(Math, 'random').mockReturnValue(0.9999999999);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects invalid programId', async () => {
    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 0, collectionCycleId: 7 }) as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'programId must be a positive integer' });
    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(Specimen.findAll).not.toHaveBeenCalled();
  });

  it('rejects when collection cycle does not belong to program', async () => {
    setupSuccessfulLookup();
    (CollectionCycle.findByPk as jest.Mock).mockResolvedValue({ id: 7, programId: 99 });

    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 1, collectionCycleId: 7 }) as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Collection cycle 7 does not belong to program 1',
    });
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it('rejects when duplicates and base are both zero', async () => {
    setupSuccessfulLookup();

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({ programId: 1, collectionCycleId: 7, duplicates: 0, base: 0 }) as any,
      reply as any
    );

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'At least one of duplicates or base must be greater than 0',
    });
  });

  it('rejects when no active superadmins exist', async () => {
    setupSuccessfulLookup();
    (User.findAll as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 1, collectionCycleId: 7 }) as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'No active annotation users found for program 1 to assign tasks to',
    });
  });

  it('rejects when no eligible specimens exist', async () => {
    setupSuccessfulLookup();
    (User.findAll as jest.Mock).mockResolvedValue([makeUser(1)]);
    (Specimen.findAll as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 1, collectionCycleId: 7 }) as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'No unassigned specimens found for program 1 in collection cycle 7',
    });
  });

  it('excludes specimens already annotated in the collection cycle', async () => {
    setupSuccessfulLookup();
    (User.findAll as jest.Mock).mockResolvedValue([makeUser(1)]);
    (Specimen.findAll as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 1, collectionCycleId: 7 }) as any, reply as any);

    const findOptions = (Specimen.findAll as jest.Mock).mock.calls[0][0];
    expect(findOptions.where.id[Op.notIn]).toEqual({
      sql: expect.stringContaining('sess.collection_cycle_id = 7'),
    });
    expect(findOptions.include[0].where.collectionCycleId).toBe(7);
  });

  it('assigns duplicate specimens to sliding windows of three superadmins', async () => {
    setupSuccessfulLookup();
    const users = [makeUser(1), makeUser(2), makeUser(3)];
    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue([
      makeSpecimen(101),
      makeSpecimen(102),
      makeSpecimen(103),
      makeSpecimen(104),
      makeSpecimen(105),
    ]);
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({ programId: 1, collectionCycleId: 7, duplicates: 2, base: 3 }) as any,
      reply as any
    );

    const byUser = getAnnotationsByUser(Annotation.bulkCreate as jest.Mock);
    expect(byUser.get(1)).toEqual([101, 102, 103]);
    expect(byUser.get(2)).toEqual([101, 102, 104]);
    expect(byUser.get(3)).toEqual([101, 102, 105]);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateSpecimensCount: 2,
        baseSpecimensCount: 3,
        totalSpecimensAssigned: 9,
      })
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('assigns duplicates and base correctly with many superadmins and specimens', async () => {
    setupSuccessfulLookup();
    const users = Array.from({ length: 6 }, (_, index) => makeUser(index + 1));
    const specimenCount = 100;
    const duplicateCount = 20;
    const baseCount = 50;

    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue(
      Array.from({ length: specimenCount }, (_, index) => makeSpecimen(index + 1))
    );
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({
        programId: 1,
        collectionCycleId: 7,
        duplicates: duplicateCount,
        base: baseCount,
      }) as any,
      reply as any
    );

    expect(AnnotationTask.create).toHaveBeenCalledTimes(6);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tasksCreated: 6,
        specimensAvailable: specimenCount,
        duplicateSpecimensCount: duplicateCount,
        baseSpecimensCount: baseCount,
        totalSpecimensAssigned: duplicateCount * 3 + baseCount,
      })
    );

    const rows = (Annotation.bulkCreate as jest.Mock).mock.calls[0][0] as Array<{
      annotatorId: number;
      specimenId: number;
    }>;
    const byUser = getAnnotationsByUser(Annotation.bulkCreate as jest.Mock);

    for (let specimenIndex = 0; specimenIndex < duplicateCount; specimenIndex++) {
      const specimenId = specimenIndex + 1;
      const expectedAdminIds = getDuplicateAdminIds(specimenIndex, users.length);
      const assignedAdminIds = rows
        .filter((row) => row.specimenId === specimenId)
        .map((row) => row.annotatorId)
        .sort((a, b) => a - b);

      expect(assignedAdminIds).toEqual([...expectedAdminIds].sort((a, b) => a - b));
    }

    const baseSpecimenIds = new Set(
      rows.filter((row) => row.specimenId > duplicateCount).map((row) => row.specimenId)
    );
    expect(baseSpecimenIds.size).toBe(baseCount);
    expect([...baseSpecimenIds].sort((a, b) => a - b)).toEqual(
      Array.from({ length: baseCount }, (_, index) => duplicateCount + index + 1)
    );

    for (const specimenId of baseSpecimenIds) {
      const assignedAdminIds = rows.filter((row) => row.specimenId === specimenId).map((row) => row.annotatorId);
      expect(assignedAdminIds).toHaveLength(1);
    }

    const baseCounts = users.map((user) => {
      const specimenIds = byUser.get(user.id) ?? [];
      return specimenIds.filter((id) => id > duplicateCount).length;
    });
    expect(baseCounts.sort((a, b) => a - b)).toEqual(
      getExpectedBaseCounts(baseCount, users.length).sort((a, b) => a - b)
    );
  });

  it('uses all available specimens as duplicates first when not enough for duplicates and base', async () => {
    setupSuccessfulLookup();
    const users = [makeUser(1), makeUser(2), makeUser(3)];
    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue([
      makeSpecimen(1),
      makeSpecimen(2),
      makeSpecimen(3),
      makeSpecimen(4),
      makeSpecimen(5),
      makeSpecimen(6),
      makeSpecimen(7),
      makeSpecimen(8),
      makeSpecimen(9),
      makeSpecimen(10),
    ]);
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({ programId: 1, collectionCycleId: 7, duplicates: 20, base: 50 }) as any,
      reply as any
    );

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        specimensAvailable: 10,
        duplicateSpecimensCount: 10,
        baseSpecimensCount: 0,
      })
    );
    expect(Annotation.bulkCreate).toHaveBeenCalled();
  });

  it('assigns remaining specimens to base equally when partially sufficient', async () => {
    setupSuccessfulLookup();
    const users = [makeUser(1), makeUser(2), makeUser(3)];
    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => makeSpecimen(index + 1))
    );
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({ programId: 1, collectionCycleId: 7, duplicates: 20, base: 50 }) as any,
      reply as any
    );

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateSpecimensCount: 20,
        baseSpecimensCount: 5,
      })
    );

    const byUser = getAnnotationsByUser(Annotation.bulkCreate as jest.Mock);
    const baseCounts = users.map((user) => {
      const specimenIds = byUser.get(user.id) ?? [];
      const baseSpecimenIds = specimenIds.filter((id) => id >= 21 && id <= 25);
      return baseSpecimenIds.length;
    });
    expect(baseCounts.sort()).toEqual([1, 2, 2]);
  });

  it('creates one task per superadmin and bulk creates annotations', async () => {
    setupSuccessfulLookup();
    const users = [makeUser(1), makeUser(2)];
    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue([makeSpecimen(1), makeSpecimen(2), makeSpecimen(3)]);
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(
      createRequest({
        programId: 1,
        collectionCycleId: 7,
        duplicates: 1,
        base: 2,
        title: 'Cycle batch',
      }) as any,
      reply as any
    );

    expect(AnnotationTask.create).toHaveBeenCalledTimes(2);
    expect(Annotation.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ annotatorId: 1, status: 'PENDING' }),
        expect.objectContaining({ annotatorId: 2, status: 'PENDING' }),
      ]),
      { transaction: mockTransaction }
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Annotation tasks created successfully',
        tasksCreated: 2,
        tasks: expect.any(Array),
      })
    );
  });

  it('defaults duplicates to 20 and base to 50', async () => {
    setupSuccessfulLookup();
    const users = [makeUser(1)];
    (User.findAll as jest.Mock).mockResolvedValue(users);
    (Specimen.findAll as jest.Mock).mockResolvedValue(
      Array.from({ length: 70 }, (_, index) => makeSpecimen(index + 1))
    );
    mockTaskCreation(users);
    (Annotation.bulkCreate as jest.Mock).mockResolvedValue([]);

    const reply = createReply();
    await createAnnotationTasks(createRequest({ programId: 1, collectionCycleId: 7 }) as any, reply as any);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateSpecimensCount: 20,
        baseSpecimensCount: 50,
      })
    );
  });
});
