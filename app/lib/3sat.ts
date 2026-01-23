export type Posicao3Sat = {
  id?: string;
  deviceId?: string;
  deviceName?: string;
  driverName?: string;
  driverCode?: string;
  fleetName?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  dateTime?: string;
  localDateTime?: string;
  address?: string;
  addressString?: string;
  plate?: string;
};

type Post3SatResponse<T> = {
  data: T;
};

const API_PROXY_URL = '/api/3sat';

async function post3Sat<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  token: string
): Promise<T> {
  const response = await fetch(API_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint, payload, token }),
    cache: 'no-store',
  });

  const result = (await response.json()) as Post3SatResponse<T> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error || 'Erro ao consultar a API da 3SAT.');
  }

  return result.data;
}

export async function consultarUltimaPosicao(token: string) {
  return post3Sat<Posicao3Sat[]>('position/last', {}, token);
}

export async function consultarPosicaoPeriodo(
  token: string,
  placa: string,
  inicio: string,
  fim: string
) {
  return post3Sat<Posicao3Sat[]>(
    'position/period',
    {
      plate: placa,
      startTime: inicio,
      endTime: fim,
    },
    token
  );
}
