/**
 * AI Error Logging Helpers
 *
 * Provides structured logging for provider errors (OpenRouter/Vercel AI SDK)
 * so we can see error.data and raw response payloads.
 */

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function normalizeHeaders(headers: unknown) {
  if (!headers) return undefined;
  if (typeof headers === 'object' && typeof (headers as Headers).forEach === 'function') {
    const out: Record<string, string> = {};
    (headers as Headers).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return headers;
}

function normalizeBody(body: unknown) {
  if (body === undefined || body === null) return body;
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(body);
    } catch {
      return '[Uint8Array]';
    }
  }
  return safeStringify(body);
}

export function logAiError(context: string, error: unknown) {
  const err = error as any;
  const details = {
    name: err?.name,
    message: err?.message,
    statusCode: err?.statusCode,
    url: err?.url,
    isRetryable: err?.isRetryable,
    data: err?.data,
    responseBody: normalizeBody(err?.responseBody),
    responseHeaders: normalizeHeaders(err?.responseHeaders),
    cause: err?.cause,
  };

  let responseBodyPreview = details.responseBody;
  if (typeof responseBodyPreview === 'string' && responseBodyPreview.length > 2000) {
    responseBodyPreview = responseBodyPreview.substring(0, 2000) + '...';
  }

  console.error(`[${context}] ❌ Error:`, err);
  console.error(`[${context}] Error details:`, {
    ...details,
    responseBody: responseBodyPreview,
  });
}
