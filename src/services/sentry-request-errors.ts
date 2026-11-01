const errorsByRequestId = new Map<string, Error>();

export function stashRequestError(requestId: string, error: Error): void {
  errorsByRequestId.set(requestId, error);
}

export function takeRequestError(requestId: string): Error | undefined {
  const error = errorsByRequestId.get(requestId);
  errorsByRequestId.delete(requestId);
  return error;
}
