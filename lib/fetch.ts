const BASE_HEADERS: Record<string, string> = {
  'ngrok-skip-browser-warning': '1',
};

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...BASE_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
