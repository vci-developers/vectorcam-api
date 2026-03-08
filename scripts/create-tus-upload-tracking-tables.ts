import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function createTusUploadTrackingTables() {
  try {
    console.log('Creating tus_upload_logs table...');

    await sequelize.getQueryInterface().createTable('tus_upload_logs', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      specimen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tus_upload_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('created', 'in_progress', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'created',
      },
      requested_image_ref: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      image_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      upload_length: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      upload_created_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      upload_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      upload_finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failure_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      s3_path: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      parts: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
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
      'CREATE INDEX idx_tus_upload_logs_specimen_id ON tus_upload_logs(specimen_id)'
    );
    await sequelize.query(
      'CREATE INDEX idx_tus_upload_logs_status ON tus_upload_logs(status)'
    );
    await sequelize.query(
      'CREATE INDEX idx_tus_upload_logs_image_id ON tus_upload_logs(image_id)'
    );
    await sequelize.query(
      'CREATE INDEX idx_tus_upload_logs_upload_created_at ON tus_upload_logs(upload_created_at)'
    );

    console.log('Tus upload tracking tables created successfully');
  } catch (error) {
    console.error('Error creating tus upload tracking tables:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

createTusUploadTrackingTables()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
