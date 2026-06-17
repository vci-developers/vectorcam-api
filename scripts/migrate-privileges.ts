import sequelize from '../src/db';
import { User } from '../src/db/models';

/**
 * One-time migration for the privilege 3/4 split:
 * - 3 -> 4 (existing annotate superadmins keep annotation access at the new level)
 *
 * Levels 0, 1, and 2 are unchanged. Do NOT re-run the older 1->2 / 2->3
 * migration here — that was for a pre-2024 legacy scale and would incorrectly
 * upgrade current read-only (1) and per-site writer (2) users.
 *
 * Run once after deploying the privilege 3/4 split:
 *   npx ts-node scripts/migrate-privileges.ts
 */
async function migratePrivileges() {
  const transaction = await sequelize.transaction();
  try {
    const users = await User.findAll({ transaction });
    let updated = 0;

    for (const user of users) {
      if (user.privilege !== 3) {
        continue;
      }

      await user.update({ privilege: 4 }, { transaction });
      updated++;
    }

    await transaction.commit();
    console.log(`Privilege migration complete. Users updated: ${updated}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Privilege migration failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migratePrivileges();

