import { Sequelize } from 'sequelize';
import HealthCenterModel from './HealthCenter';
import SiteModel from './Site';
import DeviceModel from './Device';
import SessionModel from './Session';
import SurveillanceFormModel from './SurveillanceForm';
import SpecimenModel from './Specimen';
import YoloBoxModel from './YoloBox';

// Initialize and export models
export default (sequelize: Sequelize) => {
  const HealthCenter = HealthCenterModel(sequelize);
  const Site = SiteModel(sequelize);
  const Device = DeviceModel(sequelize);
  const Session = SessionModel(sequelize);
  const SurveillanceForm = SurveillanceFormModel(sequelize);
  const YoloBox = YoloBoxModel(sequelize);
  const Specimen = SpecimenModel(sequelize);

  // Define associations here if needed
  Site.belongsTo(HealthCenter, { foreignKey: 'healthCenterId' });
  HealthCenter.hasMany(Site, { foreignKey: 'healthCenterId' });

  Device.belongsTo(Site, { foreignKey: 'siteId' });
  Site.hasMany(Device, { foreignKey: 'siteId' });

  Session.belongsTo(Device, { foreignKey: 'deviceId' });
  Device.hasMany(Session, { foreignKey: 'deviceId' });

  Session.belongsTo(Site, { foreignKey: 'siteId' });
  Site.hasMany(Session, { foreignKey: 'siteId' });

  SurveillanceForm.belongsTo(Session, { foreignKey: 'sessionId' });
  Session.hasOne(SurveillanceForm, { foreignKey: 'sessionId' });

  Specimen.belongsTo(Session, { foreignKey: 'sessionId' });
  Session.hasMany(Specimen, { foreignKey: 'sessionId' });

  Specimen.belongsTo(YoloBox, { foreignKey: 'yoloBoxId' });
  YoloBox.hasOne(Specimen, { foreignKey: 'yoloBoxId' });

  return {
    HealthCenter,
    Site,
    Device,
    Session,
    SurveillanceForm,
    YoloBox,
    Specimen
  };
};