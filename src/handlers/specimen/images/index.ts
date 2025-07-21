import { getImage } from './getImage';
import { putImage } from './putImage';
import { deleteImage } from './deleteImage';
import { uploadImage } from './uploadImage';
import { tusHandler } from './tusServer';
import * as data from './data';

export {
  getImage,
  uploadImage,
  tusHandler,
  putImage,
  deleteImage,
  // Export the data handlers as a namespace
  data
}; 