import sequelize from '../src/db';
import { User } from '../src/db/models';

/**
 * Migrates legacy privilege levels to the new scale:
 * - 1 -> 2 (read/write/push for assigned site(s))
 * - 2 -> 3 (read/write/push for all sites + annotate)
 * Other values remain unchanged.
 *
 * Run with ts-node or compile first:
 *   npx ts-node scripts/migrate-privileges.ts
 */
async function migratePrivileges() {
  const transaction = await sequelize.transaction();
  try {
    const users = await User.findAll({ transaction });
    let updated = 0;

    for (const user of users) {
      let newPrivilege = user.privilege;
      if (user.privilege === 1) newPrivilege = 2;
      else if (user.privilege === 2) newPrivilege = 3;

      if (newPrivilege !== user.privilege) {
        await user.update({ privilege: newPrivilege }, { transaction });
        updated++;
      }
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

