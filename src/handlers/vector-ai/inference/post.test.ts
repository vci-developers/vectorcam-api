import { invokeInference } from './post';

jest.mock('../../../services/sagemaker.service', () => ({
  invokeVectorAiInference: jest.fn(),
}));

import { invokeVectorAiInference } from '../../../services/sagemaker.service';

const mockInvoke = invokeVectorAiInference as jest.MockedFunction<typeof invokeVectorAiInference>;

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    body: undefined,
    log: {
      error: jest.fn(),
    },
    ...overrides,
  };
}

describe('invokeInference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 415 for unsupported content types', async () => {
    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'text/plain' },
    });

    await invokeInference(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(415);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('forwards JSON requests with base64 image', async () => {
    const imageBase64 = Buffer.from('jpeg-bytes').toString('base64');
    mockInvoke.mockResolvedValue({
      statusCode: 200,
      body: {
        model: 'yolov8n+tiny-cnn-poc',
        image_size: [100, 100],
        detections: [],
      },
    });

    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'application/json' },
      body: {
        image: imageBase64,
        confidence: 0.5,
        content_type: 'image/jpeg',
      },
    });

    await invokeInference(request as any, reply as any);

    expect(mockInvoke).toHaveBeenCalledWith({
      contentType: 'application/json',
      body: expect.any(Buffer),
    });
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      model: 'yolov8n+tiny-cnn-poc',
      image_size: [100, 100],
      detections: [],
    });
  });

  it('returns 400 for invalid base64 JSON payloads', async () => {
    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'application/json' },
      body: {
        image: 'data:image/jpeg;base64,abc',
      },
    });

    await invokeInference(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('forwards binary image requests', async () => {
    mockInvoke.mockResolvedValue({
      statusCode: 200,
      body: { model: 'yolov8n+tiny-cnn-poc', image_size: [10, 10], detections: [] },
    });

    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'image/png' },
      body: Buffer.from('png-bytes'),
    });

    await invokeInference(request as any, reply as any);

    expect(mockInvoke).toHaveBeenCalledWith({
      contentType: 'image/png',
      body: Buffer.from('png-bytes'),
    });
    expect(reply.code).toHaveBeenCalledWith(200);
  });

  it('returns 400 when binary body exceeds size limit', async () => {
    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'image/jpeg' },
      body: Buffer.alloc(6 * 1024 * 1024 + 1),
    });

    await invokeInference(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('passes through SageMaker model error status codes', async () => {
    mockInvoke.mockResolvedValue({
      statusCode: 503,
      body: { error: 'Model is loading' },
    });

    const reply = createReply();
    const request = createRequest({
      headers: { 'content-type': 'application/json' },
      body: {
        image: Buffer.from('jpeg-bytes').toString('base64'),
      },
    });

    await invokeInference(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Model is loading' });
  });
});
