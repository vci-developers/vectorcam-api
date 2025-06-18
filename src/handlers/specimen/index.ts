import { createSpecimen } from './post';
import { getSpecimenDetails } from './get';
import { updateSpecimen } from './put';
import { getSpecimenList } from './getList';
import { getUploadList } from './upload/getList';
import {
  initiateUpload,
  appendUpload,
  completeUpload,
  getUploadStatus,
} from './upload';
import {
  uploadImage,
  getImages,
  getImage
} from './images';

export {
  createSpecimen,
  getSpecimenDetails,
  updateSpecimen,
  getSpecimenList,
  getUploadList,
  uploadImage,
  getImages,
  getImage,
  initiateUpload,
  appendUpload,
  completeUpload,
  getUploadStatus,
};