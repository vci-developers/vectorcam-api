import { QueryTypes } from 'sequelize';
import sequelize from '../../db/index';

interface LoginActivityRow {
  userId: number;
  email: string;
  name: string | null;
  loginDate: string;
  loginCount: number | string;
}

export interface DailyLoginCount {
  date: string;
  count: number;
}

export interface UserLoginActivity {
  userId: number;
  email: string;
  name: string | null;
  totalLogins: number;
  dailyLogins: DailyLoginCount[];
}

export const userLoginActivitySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      userId: { type: 'number' },
      email: { type: 'string' },
      name: { type: ['string', 'null'] },
      totalLogins: { type: 'number' },
      dailyLogins: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            count: { type: 'number' },
          },
        },
      },
    },
  },
};

function buildUserLoginActivity(rows: LoginActivityRow[]): UserLoginActivity[] {
  const usersById = new Map<number, UserLoginActivity>();

  for (const row of rows) {
    const loginCount = Number(row.loginCount);
    const loginDate = String(row.loginDate).slice(0, 10);

    let user = usersById.get(row.userId);
    if (!user) {
      user = {
        userId: row.userId,
        email: row.email,
        name: row.name,
        totalLogins: 0,
        dailyLogins: [],
      };
      usersById.set(row.userId, user);
    }

    user.totalLogins += loginCount;
    user.dailyLogins.push({ date: loginDate, count: loginCount });
  }

  return Array.from(usersById.values()).sort((a, b) => a.email.localeCompare(b.email));
}

export async function queryUserLoginActivity(options: {
  startAt: Date;
  endAt: Date;
  programId?: number;
  userId?: number;
}): Promise<UserLoginActivity[]> {
  const { startAt, endAt, programId, userId } = options;
  const replacements: Record<string, unknown> = {
    eventType: 'login',
    startAt,
    endAt,
  };

  const whereClauses = [
    'e.event_type = :eventType',
    'e.created_at >= :startAt',
    'e.created_at <= :endAt',
  ];

  if (programId !== undefined) {
    replacements.programId = programId;
    whereClauses.push('u.program_id = :programId');
  }

  if (userId !== undefined) {
    replacements.userId = userId;
    whereClauses.push('u.id = :userId');
  }

  const rows = await sequelize.query(
    `
      SELECT
        u.id AS userId,
        u.email,
        u.name,
        DATE(e.created_at) AS loginDate,
        COUNT(*) AS loginCount
      FROM user_auth_events e
      INNER JOIN users u ON u.id = e.user_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY u.id, u.email, u.name, DATE(e.created_at)
      ORDER BY u.email ASC, loginDate ASC
    `,
    { replacements, type: QueryTypes.SELECT }
  ) as LoginActivityRow[];

  return buildUserLoginActivity(rows);
}
