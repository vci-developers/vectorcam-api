import {
  buildDailyLoginsSheetRows,
  buildUniqueUsersSheetRows,
  getDatesInRange,
} from './userLoginActivity';

describe('userLoginActivity sheet builders', () => {
  const users = [
    {
      userId: 1,
      email: 'alpha@example.com',
      name: 'Alpha',
      totalLogins: 3,
      dailyLogins: [
        { date: '2026-09-01', count: 2 },
        { date: '2026-09-03', count: 1 },
      ],
    },
  ];

  it('builds unique-users rows', () => {
    expect(buildUniqueUsersSheetRows(users)).toEqual([
      ['Name', 'Email', 'Total Logins'],
      ['Alpha', 'alpha@example.com', 3],
    ]);
  });

  it('builds daily-logins rows with one column per day in range', () => {
    const dates = getDatesInRange('2026-09-01', '2026-09-03');
    expect(buildDailyLoginsSheetRows(users, dates)).toEqual([
      ['Name', 'Email', '2026-09-01', '2026-09-02', '2026-09-03', 'Total Logins'],
      ['Alpha', 'alpha@example.com', 2, 0, 1, 3],
    ]);
  });
});
