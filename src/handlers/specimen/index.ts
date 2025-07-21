import { createSpecimen } from './post';
import { getSpecimenDetails } from './get';
import { updateSpecimen } from './put';
import { getSpecimenList } from './getList';
import { deleteSpecimen } from './delete';
import { exportSpecimensCSV } from './export';

import * as upload from './upload';
import * as images from './images';

export {
  createSpecimen,
  getSpecimenDetails,
  updateSpecimen,
  getSpecimenList,
  deleteSpecimen,
  exportSpecimensCSV,

  upload,
  images,
};