import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';
import { Site } from '../src/db/models';
import { rebuildLocationHierarchy } from '../src/handlers/site/common';

async function createLocationTypesTable() {
  const qi = sequelize.getQueryInterface();
  await qi.createTable('location_types', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'programs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });
}

async function addSiteHierarchyColumns() {
  const qi = sequelize.getQueryInterface();

  // location_type_id (nullable, FK to location_types)
  await qi.addColumn('sites', 'location_type_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'location_types',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // parent_id (nullable, self-FK to sites)
  await qi.addColumn('sites', 'parent_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'sites',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // name (nullable for back-compat)
  await qi.addColumn('sites', 'name', {
    type: DataTypes.STRING(255),
    allowNull: true,
  });

  // has_data (boolean, default false)
  await qi.addColumn('sites', 'has_data', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  // location_hierarchy cache (JSON)
  await qi.addColumn('sites', 'location_hierarchy', {
    type: DataTypes.JSON,
    allowNull: true,
  });
}

async function backfillHasDataFlag() {
  // Mark sites that already have sessions as has_data = 1
  await sequelize.query(`
    UPDATE sites s
    SET s.has_data = EXISTS (
      SELECT 1 FROM sessions se WHERE se.site_id = s.id
    )
  `);
}

async function backfillLocationHierarchy() {
  const sites = await Site.findAll();
  for (const site of sites) {
    await rebuildLocationHierarchy(site);
  }
}

async function main() {
  try {
    console.log('Creating location_types table...');
    await createLocationTypesTable();
    console.log('Adding hierarchy columns to sites...');
    await addSiteHierarchyColumns();
    console.log('Backfilling has_data flag on sites...');
    await backfillHasDataFlag();
    console.log('Backfilling location_hierarchy cache on sites...');
    await backfillLocationHierarchy();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default main;


