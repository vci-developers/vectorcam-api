import { DataTypes } from 'sequelize';
import sequelize from '../src/db/index';

async function addSiteLatitudeLongitudeColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const siteColumns = await queryInterface.describeTable('sites');

    if (!siteColumns.latitude) {
      console.log('Adding latitude column to sites table...');
      await queryInterface.addColumn('sites', 'latitude', {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    } else {
      console.log('sites.latitude already exists, skipping addColumn');
    }

    if (!siteColumns.longitude) {
      console.log('Adding longitude column to sites table...');
      await queryInterface.addColumn('sites', 'longitude', {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    } else {
      console.log('sites.longitude already exists, skipping addColumn');
    }

    console.log('Site latitude/longitude migration completed successfully');
  } catch (error) {
    console.error('Error adding site latitude/longitude columns:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addSiteLatitudeLongitudeColumns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
