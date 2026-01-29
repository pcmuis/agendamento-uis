'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dispositivo3Sat,
  Posicao3Sat,
  consultarUltimaPosicao,
  listarDispositivos,
} from '@/app/lib/3sat';
import type { TrackingMapProps, TrackingMarker } from './TrackingMap';

type Filtros = {
  termo: string;
  grupo: string;
  local: string;
  somenteOnline: boolean;
};

type Dispositivo3SatComPosicao = Dispositivo3Sat & {
  ultimaPosicao?: Posicao3Sat;
};

type ResumoDispositivo = {
  id: string;
  placa: string;
  nome: string;
  grupo: string;
  motorista: string;
  local: string;
  velocidade: number | null;
  status: 'online' | 'offline' | 'unknown';
  atualizadoEm: string;
  coordenadas: Coordenadas | null;
};

const TrackingMap = dynamic<TrackingMapProps>(() => import('./TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Carregando mapa...
    </div>
  ),
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const findFirstArray = <T,>(value: unknown): T[] | null => {
  if (Array.isArray(value)) return value as T[];
  if (!isObject(value)) return null;

  for (const key of Object.keys(value)) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested as T[];
  }

  for (const key of Object.keys(value)) {
    const nested = value[key];
    if (isObject(nested)) {
      for (const innerKey of Object.keys(nested)) {
        const innerValue = nested[innerKey];
        if (Array.isArray(innerValue)) return innerValue as T[];
      }
    }
  }

  return null;
};

const normalizarLista = <T,>(value: unknown): T[] => findFirstArray<T>(value) ?? [];

const normalizarDispositivos = (value: unknown): Dispositivo3Sat[] =>
  normalizarLista<Dispositivo3Sat>(value);

const normalizarPosicoes = (value: unknown): Posicao3Sat[] => {
  const lista = normalizarLista<Posicao3Sat>(value);
  if (lista.length > 0) return lista;
  if (isObject(value)) return [value as Posicao3Sat];
  return [];
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizarTexto = (valor?: string) => (valor || '').toLowerCase();

const formatarDataHora = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR');
};

const extrairPlaca = (dispositivo: Dispositivo3SatComPosicao) =>
  dispositivo.plate ||
  dispositivo.ultimaPosicao?.plate ||
  dispositivo.deviceGpsDataSingle?.plate ||
  dispositivo.lastDeviceGps?.plate ||
  '-';

const extrairNomeDispositivo = (dispositivo: Dispositivo3SatComPosicao) =>
  dispositivo.deviceName ||
  dispositivo.name ||
  dispositivo.ultimaPosicao?.deviceName ||
  dispositivo.deviceGpsDataSingle?.deviceName ||
  dispositivo.lastDeviceGps?.deviceName ||
  '-';

const extrairGrupo = (dispositivo: Dispositivo3SatComPosicao) =>
  dispositivo.deviceGroupName || dispositivo.groupName || '-';

const extrairMotorista = (dispositivo: Dispositivo3SatComPosicao) =>
  dispositivo.driverName ||
  dispositivo.ultimaPosicao?.driverName ||
  dispositivo.deviceGpsDataSingle?.driverName ||
  dispositivo.lastDeviceGps?.driverName ||
  dispositivo.lastMessage?.driver?.name ||
  '-';

const extrairLocal = (dispositivo: Dispositivo3SatComPosicao) => {
  const enderecoPosicao =
    dispositivo.ultimaPosicao?.address || dispositivo.ultimaPosicao?.addressString;
  const cidadePosicao = dispositivo.ultimaPosicao?.city;
  const enderecoGps =
    dispositivo.deviceGpsDataSingle?.address || dispositivo.lastDeviceGps?.address;
  const enderecoMsg = dispositivo.lastMessage?.location?.fullAddress;
  const rua = dispositivo.lastMessage?.location?.street;
  const numero = dispositivo.lastMessage?.location?.streetNumber;
  const cidade =
    dispositivo.deviceGpsDataSingle?.city ||
    dispositivo.lastDeviceGps?.city ||
    dispositivo.lastMessage?.location?.city;

  return (
    enderecoPosicao ||
    enderecoGps ||
    enderecoMsg ||
    [rua, numero].filter(Boolean).join(' ') ||
    cidadePosicao ||
    cidade ||
    '-'
  );
};

const extrairVelocidade = (dispositivo: Dispositivo3SatComPosicao) => {
  const velocidadePosicao = toNumber(dispositivo.ultimaPosicao?.speed);
  if (velocidadePosicao !== null) return velocidadePosicao;
  return (
    toNumber(
      dispositivo.deviceGpsDataSingle?.speed ?? dispositivo.lastDeviceGps?.speed
    ) ?? null
  );
};

type Coordenadas = {
  latitude: number;
  longitude: number;
};

const extrairCoordenadas = (
  dispositivo: Dispositivo3SatComPosicao
): Coordenadas | null => {
  const latitude = toNumber(
    dispositivo.ultimaPosicao?.latitude ??
      dispositivo.deviceGpsDataSingle?.latitude ??
      dispositivo.lastDeviceGps?.latitude
  );
  const longitude = toNumber(
    dispositivo.ultimaPosicao?.longitude ??
      dispositivo.deviceGpsDataSingle?.longitude ??
      dispositivo.lastDeviceGps?.longitude
  );

  if (latitude === null || longitude === null) {
    return null;
  }

  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return { latitude, longitude };
};

const montarUrlMapa = ({ latitude, longitude }: Coordenadas) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

const formatarCoordenadas = ({ latitude, longitude }: Coordenadas) =>
  `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

const obterStatusRotulo = (status: ResumoDispositivo['status']) => {
  if (status === 'online') return 'Online';
  if (status === 'unknown') return 'Sem sinal';
  return 'Offline';
};

const obterStatusClasse = (status: ResumoDispositivo['status']) => {
  if (status === 'online') return 'bg-green-100 text-green-700';
  if (status === 'unknown') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

const extrairAtualizacao = (dispositivo: Dispositivo3SatComPosicao) =>
  dispositivo.ultimaPosicao?.localDateTime ||
  dispositivo.ultimaPosicao?.dateTime ||
  dispositivo.deviceGpsDataSingle?.localCreationTime ||
  dispositivo.deviceGpsDataSingle?.dateTime ||
  dispositivo.lastDeviceGps?.localCreationTime ||
  dispositivo.lastMessage?.localPositionDateTime ||
  undefined;

const extrairOnline = (dispositivo: Dispositivo3SatComPosicao) => {
  const onlineGps = dispositivo.deviceGpsDataSingle?.isOnline;
  const onlineUltimo = dispositivo.lastDeviceGps?.isOnline;
  const onlineMensagem = dispositivo.lastMessage?.network?.online;
  if (typeof onlineGps === 'boolean') return onlineGps;
  if (typeof onlineUltimo === 'boolean') return onlineUltimo;
  if (typeof onlineMensagem === 'boolean') return onlineMensagem;
  return false;
};

const extrairSemSinal = (dispositivo: Dispositivo3SatComPosicao) => {
  const semSinalGps = dispositivo.deviceGpsDataSingle?.hasLostConnection;
  const semSinalUltimo = dispositivo.lastDeviceGps?.hasLostConnection;
  if (typeof semSinalGps === 'boolean') return semSinalGps;
  if (typeof semSinalUltimo === 'boolean') return semSinalUltimo;
  return false;
};

const obterChavesPosicao = (posicao: Posicao3Sat) =>
  [posicao.deviceId, posicao.id, posicao.plate].filter(Boolean) as string[];

const obterChavesDispositivo = (dispositivo: Dispositivo3Sat) =>
  [
    dispositivo.deviceId,
    dispositivo.id,
    dispositivo.plate,
    dispositivo.deviceGpsDataSingle?.plate,
    dispositivo.lastDeviceGps?.plate,
  ].filter(Boolean) as string[];

const obterChavePrincipal = (
  dispositivo: Dispositivo3SatComPosicao,
  index: number
) => {
  const chaves = obterChavesDispositivo(dispositivo);
  return chaves.length > 0 ? chaves[0] : `dispositivo-${index}`;
};

const anexarPosicoes = (
  dispositivos: Dispositivo3Sat[],
  posicoes: Posicao3Sat[]
): Dispositivo3SatComPosicao[] => {
  const indice = new Map<string, Posicao3Sat>();
  posicoes.forEach((posicao) => {
    obterChavesPosicao(posicao).forEach((chave) => {
      if (!indice.has(chave)) {
        indice.set(chave, posicao);
      }
    });
  });

  return dispositivos.map((dispositivo) => {
    const chaves = obterChavesDispositivo(dispositivo);
    const ultimaPosicao = chaves
      .map((chave) => indice.get(chave))
      .find((posicao) => Boolean(posicao));
    return { ...dispositivo, ultimaPosicao };
  });
};

export default function Rastreamento3SatPage() {
  const [dispositivos, setDispositivos] = useState<Dispositivo3SatComPosicao[]>(
    []
  );
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({
    termo: '',
    grupo: '',
    local: '',
    somenteOnline: false,
  });
  const [focoId, setFocoId] = useState<string | null>(null);
  const mapaRef = useRef<HTMLDivElement | null>(null);

  const carregarDispositivos = async () => {
    setErro('');
    setCarregando(true);
    try {
      const [dispositivosResult, posicoesResult] = await Promise.allSettled([
        listarDispositivos(),
        consultarUltimaPosicao(),
      ]);

      if (dispositivosResult.status === 'rejected') {
        throw dispositivosResult.reason;
      }

      const listaDispositivos = normalizarDispositivos(dispositivosResult.value);
      const listaPosicoes =
        posicoesResult.status === 'fulfilled'
          ? normalizarPosicoes(posicoesResult.value)
          : [];

      if (posicoesResult.status === 'rejected') {
        setErro(
          posicoesResult.reason instanceof Error
            ? posicoesResult.reason.message
            : 'Erro ao carregar localizacoes da 3SAT.'
        );
      }

      const dispositivosComPosicao = anexarPosicoes(
        listaDispositivos,
        listaPosicoes
      );
      setDispositivos(dispositivosComPosicao);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar dispositivos da 3SAT.'
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDispositivos();
  }, []);

  const gruposDisponiveis = useMemo(() => {
    const grupos = new Set<string>();
    dispositivos.forEach((dispositivo) => {
      const grupo = extrairGrupo(dispositivo);
      if (grupo && grupo !== '-') grupos.add(grupo);
    });
    return Array.from(grupos).sort();
  }, [dispositivos]);

  const dispositivosFiltrados = useMemo(() => {
    const termo = normalizarTexto(filtros.termo);
    const local = normalizarTexto(filtros.local);
    return dispositivos.filter((dispositivo) => {
      const placa = normalizarTexto(extrairPlaca(dispositivo));
      const nome = normalizarTexto(extrairNomeDispositivo(dispositivo));
      const motorista = normalizarTexto(extrairMotorista(dispositivo));
      const grupo = extrairGrupo(dispositivo);
      const endereco = normalizarTexto(extrairLocal(dispositivo));

      const combinaTermo =
        !termo || placa.includes(termo) || nome.includes(termo) || motorista.includes(termo);
      const combinaGrupo = !filtros.grupo || grupo === filtros.grupo;
      const combinaLocal = !local || endereco.includes(local);
      const combinaOnline = !filtros.somenteOnline || extrairOnline(dispositivo);

      return combinaTermo && combinaGrupo && combinaLocal && combinaOnline;
    });
  }, [dispositivos, filtros]);

  const dispositivosResumo = useMemo<ResumoDispositivo[]>(() => {
    return dispositivosFiltrados.map((dispositivo, index) => {
      const placa = extrairPlaca(dispositivo);
      const nome = extrairNomeDispositivo(dispositivo);
      const grupo = extrairGrupo(dispositivo);
      const motorista = extrairMotorista(dispositivo);
      const local = extrairLocal(dispositivo);
      const velocidade = extrairVelocidade(dispositivo);
      const online = extrairOnline(dispositivo);
      const semSinal = extrairSemSinal(dispositivo);
      const status = semSinal ? 'unknown' : online ? 'online' : 'offline';
      const atualizadoEm = formatarDataHora(extrairAtualizacao(dispositivo));
      const coordenadas = extrairCoordenadas(dispositivo);
      const id = obterChavePrincipal(dispositivo, index);

      return {
        id,
        placa,
        nome,
        grupo,
        motorista,
        local,
        velocidade,
        status,
        atualizadoEm,
        coordenadas,
      };
    });
  }, [dispositivosFiltrados]);

  const marcadores = useMemo<TrackingMarker[]>(() => {
    return dispositivosResumo
      .filter((item) => Boolean(item.coordenadas))
      .map((item) => {
        const coordenadas = item.coordenadas as Coordenadas;
        return {
          id: item.id,
          titulo: `${item.placa} • ${item.nome}`,
          subtitulo: item.grupo !== '-' ? item.grupo : 'Sem grupo',
          status: item.status,
          coordenadas,
          urlMapa: montarUrlMapa(coordenadas),
          detalhes: [
            { label: 'Motorista', valor: item.motorista },
            { label: 'Status', valor: obterStatusRotulo(item.status) },
            {
              label: 'Velocidade',
              valor: item.velocidade !== null ? `${item.velocidade} km/h` : '-',
            },
            { label: 'Atualizado', valor: item.atualizadoEm },
            { label: 'Local', valor: item.local },
            { label: 'Lat/Long', valor: formatarCoordenadas(coordenadas) },
          ],
        };
      });
  }, [dispositivosResumo]);

  const centroInicial = useMemo<Coordenadas>(() => {
    if (marcadores.length > 0) {
      return marcadores[0].coordenadas;
    }
    return { latitude: -23.55052, longitude: -46.633308 };
  }, [marcadores]);

  const totalOnline = useMemo(
    () => dispositivosResumo.filter((item) => item.status === 'online').length,
    [dispositivosResumo]
  );

  const totalSemSinal = useMemo(
    () => dispositivosResumo.filter((item) => item.status === 'unknown').length,
    [dispositivosResumo]
  );

  const totalOffline = useMemo(
    () => dispositivosResumo.filter((item) => item.status === 'offline').length,
    [dispositivosResumo]
  );

  useEffect(() => {
    if (!focoId) return;
    const existe = marcadores.some((marcador) => marcador.id === focoId);
    if (!existe) {
      setFocoId(null);
    }
  }, [focoId, marcadores]);

  const focarNoMapa = useCallback((id: string) => {
    setFocoId(id);
    mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const limparFiltros = () => {
    setFiltros({ termo: '', grupo: '', local: '', somenteOnline: false });
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-green-800">
          Administracao 3SAT
        </h1>
        <p className="text-sm text-green-700 mt-2">
          A credencial e lida do ambiente (THREESAT_TOKEN) no servidor.
        </p>
      </header>

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-green-800">
              Busca de dispositivos
            </h2>
            <p className="text-xs text-gray-500">
              Filtre por placa, dispositivo, motorista, grupo ou local.
            </p>
          </div>
          <button
            onClick={carregarDispositivos}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
            disabled={carregando}
          >
            {carregando ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-green-700 mb-1">
              Placa ou dispositivo
            </label>
            <input
              type="text"
              value={filtros.termo}
              onChange={(event) =>
                setFiltros((prev) => ({ ...prev, termo: event.target.value }))
              }
              className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
              placeholder="Ex: ABC1D23, Caminhao 12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">
              Grupo
            </label>
            <select
              value={filtros.grupo}
              onChange={(event) =>
                setFiltros((prev) => ({ ...prev, grupo: event.target.value }))
              }
              className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
            >
              <option value="">Todos os grupos</option>
              {gruposDisponiveis.map((grupo) => (
                <option key={grupo} value={grupo}>
                  {grupo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">
              Local
            </label>
            <input
              type="text"
              value={filtros.local}
              onChange={(event) =>
                setFiltros((prev) => ({ ...prev, local: event.target.value }))
              }
              className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
              placeholder="Cidade, endereco, area"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtros.somenteOnline}
              onChange={(event) =>
                setFiltros((prev) => ({
                  ...prev,
                  somenteOnline: event.target.checked,
                }))
              }
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded"
            />
            Mostrar somente online
          </label>
          <div className="flex items-center gap-3">
            <span>
              Total: {dispositivos.length} | Exibindo: {dispositivosFiltrados.length}
            </span>
            <button
              onClick={limparFiltros}
              className="text-green-700 hover:text-green-900"
              type="button"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
          {erro}
        </div>
      )}

      <div
        ref={mapaRef}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-green-800">
                Mapa de rastreamento
              </h2>
              <p className="text-xs text-gray-500">
                OpenStreetMap com checkpoints e detalhes do veiculo.
              </p>
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
              <span>Total: {dispositivosResumo.length}</span>
              <span>Online: {totalOnline}</span>
              <span>Offline: {totalOffline}</span>
              <span>Sem sinal: {totalSemSinal}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
              Online
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
              Offline
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-400"></span>
              Sem sinal
            </span>
            {carregando && (
              <span className="text-green-700 font-medium">Atualizando...</span>
            )}
          </div>

          <div className="mt-4 h-[420px] sm:h-[520px]">
            {marcadores.length > 0 ? (
              <TrackingMap
                markers={marcadores}
                focusId={focoId}
                onFocusChange={setFocoId}
                center={centroInicial}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Nenhuma coordenada encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-green-800">
                Visor de veiculos
              </h2>
              <p className="text-xs text-gray-500">
                Clique em "Ver no mapa" para focar o checkpoint.
              </p>
            </div>
            <div className="text-xs text-gray-500 text-right">
              <p>Com localizacao: {marcadores.length}</p>
              <p>Sem localizacao: {dispositivosResumo.length - marcadores.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {dispositivosResumo.length === 0 ? (
              <p className="text-sm text-gray-600">
                Nenhum dispositivo encontrado.
              </p>
            ) : (
              dispositivosResumo.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    focoId === item.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-green-100 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.placa}
                      </p>
                      <p className="text-xs text-gray-500">{item.nome}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${
                        obterStatusClasse(item.status)
                      }`}
                    >
                      {obterStatusRotulo(item.status)}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>
                      <span className="font-medium text-gray-700">Motorista:</span>{' '}
                      {item.motorista}
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Local:</span>{' '}
                      {item.local}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <span>
                        <span className="font-medium text-gray-700">
                          Velocidade:
                        </span>{' '}
                        {item.velocidade !== null ? `${item.velocidade} km/h` : '-'}
                      </span>
                      <span>
                        <span className="font-medium text-gray-700">
                          Atualizado:
                        </span>{' '}
                        {item.atualizadoEm}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.coordenadas ? (
                      <>
                        <button
                          type="button"
                          onClick={() => focarNoMapa(item.id)}
                          className="inline-flex items-center rounded-md border border-green-600 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50"
                        >
                          Ver no mapa
                        </button>
                        <a
                          href={montarUrlMapa(item.coordenadas)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Abrir no OpenStreet
                        </a>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-400 cursor-not-allowed"
                        disabled
                      >
                        Sem localizacao
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-green-800">
              Tabela detalhada
            </h2>
            <p className="text-xs text-gray-500">
              Relacao completa dos dispositivos filtrados.
            </p>
          </div>
          <span className="text-xs text-gray-500">
            {dispositivosResumo.length} dispositivos
          </span>
        </div>

        <div className="mt-4">
          {carregando ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
            </div>
          ) : dispositivosResumo.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum dispositivo encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-green-100 text-green-700">
                  <tr>
                    <th className="p-3 text-left">Placa</th>
                    <th className="p-3 text-left">Dispositivo</th>
                    <th className="p-3 text-left">Grupo</th>
                    <th className="p-3 text-left">Motorista</th>
                    <th className="p-3 text-left">Local</th>
                    <th className="p-3 text-left">Velocidade</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Atualizacao</th>
                  </tr>
                </thead>
                <tbody>
                  {dispositivosResumo.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 text-gray-900 font-medium">{item.placa}</td>
                      <td className="p-3 text-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.nome}</span>
                          {item.coordenadas ? (
                            <button
                              type="button"
                              onClick={() => focarNoMapa(item.id)}
                              className="inline-flex items-center rounded-md border border-green-600 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50"
                            >
                              Ver no mapa
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-400 cursor-not-allowed"
                              disabled
                            >
                              Sem local
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-900">{item.grupo}</td>
                      <td className="p-3 text-gray-900">{item.motorista}</td>
                      <td className="p-3 text-gray-900">{item.local}</td>
                      <td className="p-3 text-gray-900">
                        {item.velocidade !== null ? `${item.velocidade} km/h` : '-'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            obterStatusClasse(item.status)
                          }`}
                        >
                          {obterStatusRotulo(item.status)}
                        </span>
                      </td>
                      <td className="p-3 text-gray-900">{item.atualizadoEm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
