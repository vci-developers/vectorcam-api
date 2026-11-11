import { buildDataRecoveryObjectKey, extensionFromContentType } from './s3ObjectKey';

describe('data recovery S3 object keys', () => {
  it('builds keys under the recovery prefix', () => {
    expect(buildDataRecoveryObjectKey('data-recoveries', 42, 'abc123', 'image/jpeg')).toBe(
      'data-recoveries/42/abc123.jpeg'
    );
  });

  it('maps common image content types to extensions', () => {
    expect(extensionFromContentType('image/png')).toBe('png');
    expect(extensionFromContentType('image/webp')).toBe('webp');
    expect(extensionFromContentType(undefined)).toBe('bin');
  });
});
