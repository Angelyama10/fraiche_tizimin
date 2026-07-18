export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type NextRequestInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

export function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return (
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api/v1'
    );
  }

  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
}

export async function apiRequest<T>(path: string, init: NextRequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    throw new ApiError(
      'No pudimos conectar con la tienda. Revisa que Docker siga encendido.',
      0,
      error,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? Array.isArray(payload.message)
          ? payload.message.join(' ')
          : String(payload.message)
        : `La solicitud fallo (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrio un error inesperado.';
}
