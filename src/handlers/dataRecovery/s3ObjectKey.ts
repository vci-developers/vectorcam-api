const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function extensionFromContentType(contentType: string | undefined): string {
  if (!contentType) {
    return 'bin';
  }
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (CONTENT_TYPE_EXTENSION[normalized]) {
    return CONTENT_TYPE_EXTENSION[normalized];
  }
  const subtype = normalized.split('/')[1];
  return subtype && /^[a-z0-9.+$-]+$/.test(subtype) ? subtype : 'bin';
}

export function buildDataRecoveryObjectKey(
  objectPrefix: string,
  recoveryId: number,
  filemd5: string,
  contentType?: string
): string {
  const prefix = objectPrefix.replace(/\/+$/, '');
  const ext = extensionFromContentType(contentType);
  return `${prefix}/${recoveryId}/${filemd5}.${ext}`;
}
