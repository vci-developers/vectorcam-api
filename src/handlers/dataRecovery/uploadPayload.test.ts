import {
  finalizeDataRecoveryUpload,
  getUploadInfoFromPayload,
  isRecoveryUploadComplete,
  mergeDataRecoveryUploadPayload,
} from './uploadPayload';

describe('data recovery upload payload helpers', () => {
  it('merges upload metadata into existing payload', () => {
    const next = mergeDataRecoveryUploadPayload(
      { type: 'stale_specimen_image', clientSpecimenId: 'a' },
      { state: 'in_progress', filemd5: 'abc', tusUploadId: 'tus-1' }
    );
    expect(next).toEqual({
      type: 'stale_specimen_image',
      clientSpecimenId: 'a',
      upload: { state: 'in_progress', filemd5: 'abc', tusUploadId: 'tus-1' },
    });
  });

  it('detects completed uploads by filemd5', () => {
    const payload = {
      upload: {
        state: 'uploaded',
        filemd5: 'd41d8cd98f00b204e9800998ecf8427e',
        s3Key: 'key',
      },
    };
    expect(isRecoveryUploadComplete(payload, 'd41d8cd98f00b204e9800998ecf8427e')).toBe(true);
    expect(isRecoveryUploadComplete(payload, '00000000000000000000000000000000')).toBe(false);
  });

  it('finalizes upload into payload and sets status uploaded', () => {
    const result = finalizeDataRecoveryUpload({
      payload: { type: 'stale_specimen_image' },
      status: 'pending_upload',
      tusUploadId: 'tus-2',
      s3Key: 'data-recoveries/1/obj',
      s3Bucket: 'vectorcam-test',
      filemd5: 'd41d8cd98f00b204e9800998ecf8427e',
      contentType: 'image/jpeg',
      bytes: 100,
    });
    expect(result.duplicate).toBe(false);
    expect(result.nextStatus).toBe('uploaded');
    const upload = getUploadInfoFromPayload(result.nextPayload);
    expect(upload).toMatchObject({
      state: 'uploaded',
      s3Key: 'data-recoveries/1/obj',
      s3Bucket: 'vectorcam-test',
      filemd5: 'd41d8cd98f00b204e9800998ecf8427e',
      tusUploadId: 'tus-2',
      contentType: 'image/jpeg',
      bytes: 100,
    });
    expect(typeof upload?.uploadedAt).toBe('number');
  });

  it('is idempotent when the same filemd5 is already uploaded', () => {
    const payload = {
      upload: {
        state: 'uploaded',
        filemd5: 'abc',
        s3Key: 'existing',
        s3Bucket: 'b',
      },
    };
    const result = finalizeDataRecoveryUpload({
      payload,
      status: 'uploaded',
      tusUploadId: 'tus-3',
      s3Key: 'new',
      s3Bucket: 'b',
      filemd5: 'abc',
    });
    expect(result.duplicate).toBe(true);
    expect(result.nextPayload).toEqual(payload);
  });
});
