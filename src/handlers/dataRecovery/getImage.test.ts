import { DataRecovery } from '../../db/models';
import { getDataRecoveryImage } from './getImage';

jest.mock('../../db/models', () => ({
  DataRecovery: {
    findByPk: jest.fn(),
  },
}));

jest.mock('../../services/s3.service', () => ({
  getMainS3Bucket: jest.fn(() => 'vectorcam-test'),
  getFileStreamFromBucket: jest.fn(),
}));

const mockedDataRecovery = DataRecovery as jest.Mocked<typeof DataRecovery>;
const s3 = jest.requireMock('../../services/s3.service');

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
}

describe('getDataRecoveryImage', () => {
  it('returns 404 when upload is not complete', async () => {
    mockedDataRecovery.findByPk.mockResolvedValue({
      id: 1,
      payload: { upload: { state: 'in_progress' } },
    } as any);
    const reply = createReply();

    await getDataRecoveryImage({ params: { id: 1 }, log: { error: jest.fn() } } as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Recovery image not available' });
  });

  it('streams image when s3Key is present', async () => {
    const stream = { pipe: jest.fn() };
    s3.getFileStreamFromBucket.mockResolvedValue({ stream, contentType: 'image/jpeg' });
    mockedDataRecovery.findByPk.mockResolvedValue({
      id: 1,
      payload: {
        upload: {
          state: 'uploaded',
          s3Key: 'data-recoveries/1/abc.jpeg',
          s3Bucket: 'vectorcam-test',
          filemd5: 'abc',
          contentType: 'image/jpeg',
        },
      },
    } as any);
    const reply = createReply();

    await getDataRecoveryImage({ params: { id: 1 }, log: { error: jest.fn() } } as any, reply as any);

    expect(s3.getFileStreamFromBucket).toHaveBeenCalledWith('vectorcam-test', 'data-recoveries/1/abc.jpeg');
    expect(reply.header).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(reply.send).toHaveBeenCalledWith(stream);
  });
});
