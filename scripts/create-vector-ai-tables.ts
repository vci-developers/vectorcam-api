import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

const DEFAULT_SPECIES_ENDPOINT = 'vector-ai-inference';

async function createVectorAiTables() {
  try {
    console.log('Creating vector_ai_models table...');

    await sequelize.getQueryInterface().createTable('vector_ai_models', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      field: {
        type: DataTypes.ENUM('species', 'sex', 'abdomen_status'),
        allowNull: false,
      },
      version: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sagemaker_endpoint: {
        type: DataTypes.STRING(255),
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

    await sequelize.query(
      'CREATE UNIQUE INDEX vector_ai_models_field_version_unique ON vector_ai_models (field, version)'
    );

    const speciesEndpoint =
      process.env.VECTOR_AI_INFERENCE_ENDPOINT?.trim() || DEFAULT_SPECIES_ENDPOINT;

    await sequelize.query(
      `INSERT INTO vector_ai_models (field, version, description, sagemaker_endpoint, created_at, updated_at)
       VALUES (
         'species',
         'v1.0',
         'Initial species classifier served on the vector-ai-inference SageMaker endpoint.',
         :endpoint,
         NOW(),
         NOW()
       )`,
      { replacements: { endpoint: speciesEndpoint } }
    );

    console.log('vector_ai_models table created and species v1.0 seeded successfully');

    console.log('Creating vector_ai_inference_results table...');

    await sequelize.getQueryInterface().createTable('vector_ai_inference_results', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      specimen_image_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'specimen_images',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      vector_ai_model_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'vector_ai_models',
          key: 'id',
        },
        onDelete: 'RESTRICT',
      },
      value: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      result_log: {
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
      'CREATE UNIQUE INDEX vector_ai_inference_results_image_model_unique ON vector_ai_inference_results (specimen_image_id, vector_ai_model_id)'
    );
    await sequelize.query(
      'CREATE INDEX vector_ai_inference_results_specimen_image_id ON vector_ai_inference_results (specimen_image_id)'
    );
    await sequelize.query(
      'CREATE INDEX vector_ai_inference_results_vector_ai_model_id ON vector_ai_inference_results (vector_ai_model_id)'
    );

    console.log('vector_ai_inference_results table created successfully');
  } catch (error) {
    console.error('Error creating vector AI tables:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

createVectorAiTables()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
