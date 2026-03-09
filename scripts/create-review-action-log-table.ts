import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createReviewActionLogTable() {
  try {
    console.log('Creating review_action_logs table...');

    await sequelize.getQueryInterface().createTable('review_action_logs', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      site_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      has_changes: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      changes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      fields: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
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

    await sequelize.query(
      'CREATE INDEX idx_review_action_logs_site_period ON review_action_logs(site_id, year, month)'
    );
    await sequelize.query('CREATE INDEX idx_review_action_logs_action ON review_action_logs(action)');
    await sequelize.query('CREATE INDEX idx_review_action_logs_user_id ON review_action_logs(user_id)');

    console.log('review_action_logs table created successfully');
  } catch (error) {
    console.error('Error creating review_action_logs table:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

createReviewActionLogTable()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
