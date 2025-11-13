import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createSessionConflictResolutionsTable() {
  try {
    console.log('Creating session_conflict_resolutions table...');
    
    await sequelize.getQueryInterface().createTable('session_conflict_resolutions', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      resolved_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      session_ids: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      site_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      before_data: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      after_data: {
        type: DataTypes.JSON,
        allowNull: false,
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
    
    console.log('Successfully created session_conflict_resolutions table');
    
    // Add check constraint for month validation
    await sequelize.query(
      'ALTER TABLE session_conflict_resolutions ADD CONSTRAINT check_month_range CHECK (month >= 1 AND month <= 12)'
    );
    
    console.log('Added check constraint for month validation');
    
    // Add indexes for common query patterns
    await sequelize.query(
      'CREATE INDEX idx_session_conflict_resolutions_site_id ON session_conflict_resolutions(site_id)'
    );
    
    await sequelize.query(
      'CREATE INDEX idx_session_conflict_resolutions_month_year ON session_conflict_resolutions(month, year)'
    );
    
    console.log('Added indexes for efficient querying');
    
  } catch (error) {
    console.error('Error creating session_conflict_resolutions table:', error);
    throw error;
  }
}

async function main() {
  try {
    await createSessionConflictResolutionsTable();
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

export default createSessionConflictResolutionsTable;

