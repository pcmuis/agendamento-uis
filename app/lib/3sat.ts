export type Posicao3Sat = {
  id?: string;
  deviceId?: string;
  deviceName?: string;
  driverName?: string;
  driverCode?: string;
  fleetName?: string;
  latitude?: number | string;
  longitude?: number | string;
  speed?: number | string;
  dateTime?: string;
  localDateTime?: string;
  address?: string;
  addressString?: string;
  plate?: string;
  city?: string;
};

export type Dispositivo3Sat = {
  id?: string;
  deviceId?: string;
  deviceName?: string;
  name?: string;
  deviceGroupName?: string;
  groupName?: string;
  companyName?: string;
  statusName?: string;
  plate?: string;
  driverName?: string;
  driverCode?: string;
  deviceGpsDataSingle?: {
    plate?: string;
    deviceName?: string;
    driverName?: string;
    latitude?: number;
    longitude?: number;
    speed?: number;
    address?: string;
    city?: string;
    localCreationTime?: string;
    dateTime?: string;
    isOnline?: boolean;
    hasLostConnection?: boolean;
  };
  lastDeviceGps?: {
    plate?: string;
    deviceName?: string;
    driverName?: string;
    latitude?: number;
    longitude?: number;
    speed?: number;
    address?: string;
    city?: string;
    localCreationTime?: string;
    isOnline?: boolean;
    hasLostConnection?: boolean;
  };
  lastMessage?: {
    deviceName?: string;
    driver?: { name?: string; code?: string };
    location?: {
      fullAddress?: string;
      city?: string;
      street?: string;
      streetNumber?: string;
    };
    network?: { online?: boolean };
    localPositionDateTime?: string;
  };
};

type Post3SatResponse<T> = {
  data: T;
};

const API_PROXY_URL = '/api/3sat';

async function post3Sat<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(API_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint, payload }),
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

export async function consultarUltimaPosicao() {
  return post3Sat<Posicao3Sat[]>('position/last', {});
}

export async function consultarPosicaoPeriodo(
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
    }
  );
}

export async function listarDispositivos() {
  return post3Sat<Dispositivo3Sat[]>('device/getall', {});
}
