import { Injectable } from '@nestjs/common';
import { responseHeadersToReturn } from './http-headers.js';

export interface UpstreamRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
  timeoutMs: number;
}

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export type UpstreamErrorCode = 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNREACHABLE';

export class UpstreamError extends Error {
  constructor(readonly code: UpstreamErrorCode) {
    super(code);
  }
}

@Injectable()
export class UpstreamClient {
  async send(request: UpstreamRequest): Promise<UpstreamResponse> {
    const startedAt = Date.now();

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? new Uint8Array(request.body) : undefined,
        signal: AbortSignal.timeout(request.timeoutMs),
      });

      return {
        status: response.status,
        headers: responseHeadersToReturn(response.headers),
        body: await response.text(),
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new UpstreamError(
        timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
      );
    }
  }
}
