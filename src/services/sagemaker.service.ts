import {
  InvokeEndpointCommand,
  ModelError,
  ModelNotReadyException,
  SageMakerRuntimeClient,
} from '@aws-sdk/client-sagemaker-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { config } from '../config/environment';
import pino from 'pino';

const logger = pino();

const INFERENCE_REQUEST_TIMEOUT_MS = 120_000;

export const sagemakerRuntimeClient = new SageMakerRuntimeClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId || '',
    secretAccessKey: config.aws.secretAccessKey || '',
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: INFERENCE_REQUEST_TIMEOUT_MS,
    requestTimeout: INFERENCE_REQUEST_TIMEOUT_MS,
  }),
});

export interface InvokeVectorAiInferenceInput {
  contentType: string;
  body: Uint8Array;
}

export interface InvokeVectorAiInferenceResult {
  statusCode: number;
  body: unknown;
}

function parseModelErrorBody(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    return { error: message };
  }
}

export async function invokeVectorAiInference(
  input: InvokeVectorAiInferenceInput
): Promise<InvokeVectorAiInferenceResult> {
  try {
    const response = await sagemakerRuntimeClient.send(
      new InvokeEndpointCommand({
        EndpointName: config.aws.vectorAiInferenceEndpoint,
        ContentType: input.contentType,
        Accept: 'application/json',
        Body: input.body,
      })
    );

    const responseText = await response.Body?.transformToString();
    if (!responseText) {
      return { statusCode: 502, body: { error: 'Empty response from inference endpoint' } };
    }

    return {
      statusCode: 200,
      body: JSON.parse(responseText),
    };
  } catch (error) {
    if (error instanceof ModelError) {
      const statusCode = error.OriginalStatusCode ?? error.$metadata.httpStatusCode ?? 502;
      const body = parseModelErrorBody(error.OriginalMessage ?? 'Inference model error');
      return { statusCode, body };
    }

    if (error instanceof ModelNotReadyException) {
      return {
        statusCode: 503,
        body: { error: 'Inference model is not ready yet. Retry after a few seconds.' },
      };
    }

    logger.error({ err: error }, 'SageMaker invoke failed');
    throw error;
  }
}
