'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dispositivo3Sat,
  Posicao3Sat,
  consultarUltimaPosicao,
  listarDispositivos,
} from '@/app/lib/3sat';

type Filtros = {
  termo: string;
  grupo: string;
  local: string;
  somenteOnline: boolean;
};

type Dispositivo3SatComPosicao = Dispositivo3Sat & {
  ultimaPosicao?: Posicao3Sat;
};

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

type PontoMapa = {
  id: string;
  nome: string;
  placa: string;
  grupo: string;
  latitude: number;
  longitude: number;
  velocidade: number | null;
  atualizadoEm?: string;
  local?: string;
  online?: boolean;
  altitude?: number | null;
};

type LeafletNamespace = typeof import('leaflet');

const escapeHtml = (value: unknown) => {
  const safe = String(value ?? '');
  return safe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

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

const MAPA_PADRAO = { latitude: -14.235, longitude: -51.9253 };

const MapaVeiculos = ({ pontos }: { pontos: PontoMapa[] }) => {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerRef = useRef<import('leaflet').FeatureGroup | null>(null);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let ativo = true;

    const iniciarMapa = async () => {
      if (!mapElementRef.current || mapRef.current) return;
      const leaflet = await import('leaflet');
      if (!ativo) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(mapElementRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });

      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(map);

      map.setView([MAPA_PADRAO.latitude, MAPA_PADRAO.longitude], 4);
      mapRef.current = map;
      layerRef.current = leaflet.featureGroup().addTo(map);
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 0);
    };

    iniciarMapa();

    return () => {
      ativo = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !layerRef.current || !leafletRef.current) return;

    const leaflet = leafletRef.current;
    layerRef.current.clearLayers();

    const bounds: [number, number][] = [];

    pontos.forEach((ponto) => {
      const grupo = ponto.grupo && ponto.grupo !== '-' ? ponto.grupo : '';
      const local = ponto.local && ponto.local !== '-' ? ponto.local : '';
      const atualizadoEm =
        ponto.atualizadoEm && ponto.atualizadoEm !== '-' ? ponto.atualizadoEm : '';
      const popupLines = [
        `<strong>${escapeHtml(ponto.nome)}</strong>`,
        ponto.placa ? `Placa: ${escapeHtml(ponto.placa)}` : '',
        grupo ? `Grupo: ${escapeHtml(grupo)}` : '',
        local ? `Local: ${escapeHtml(local)}` : '',
        ponto.velocidade !== null
          ? `Velocidade: ${escapeHtml(ponto.velocidade)} km/h`
          : '',
        ponto.altitude !== null && ponto.altitude !== undefined
          ? `Altitude: ${escapeHtml(ponto.altitude)} m`
          : '',
        atualizadoEm ? `Atualizado: ${escapeHtml(atualizadoEm)}` : '',
        typeof ponto.online === 'boolean'
          ? `Status: ${ponto.online ? 'Online' : 'Offline'}`
          : '',
      ]
        .filter(Boolean)
        .join('<br/>');

      const marker = leaflet.circleMarker([ponto.latitude, ponto.longitude], {
        radius: 6,
        weight: 2,
        color: ponto.online ? '#15803d' : '#64748b',
        fillColor: ponto.online ? '#22c55e' : '#e2e8f0',
        fillOpacity: 0.9,
      });

      marker.bindPopup(popupLines);
      marker.addTo(layerRef.current);
      bounds.push([ponto.latitude, ponto.longitude]);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [24, 24] });
    } else {
      mapRef.current.setView([MAPA_PADRAO.latitude, MAPA_PADRAO.longitude], 4);
    }

    setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [pontos, mapReady]);

  return (
    <div className="relative">
      <div
        ref={mapElementRef}
        className="h-[420px] w-full rounded-md border border-green-200"
      />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
          Carregando mapa...
        </div>
      )}
    </div>
  );
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

const extrairAltitude = (dispositivo: Dispositivo3SatComPosicao) =>
  toNumber(dispositivo.ultimaPosicao?.altitude) ?? null;

const obterIdentificador = (
  dispositivo: Dispositivo3SatComPosicao,
  index: number
) =>
  dispositivo.deviceId ||
  dispositivo.id ||
  dispositivo.plate ||
  dispositivo.deviceGpsDataSingle?.plate ||
  dispositivo.lastDeviceGps?.plate ||
  `idx-${index}`;

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
  const [modoMapa, setModoMapa] = useState<'todos' | 'selecionados'>('todos');
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());

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

  const dispositivosMapeaveis = useMemo(() => {
    return dispositivosFiltrados
      .map((dispositivo, index) => {
        const coordenadas = extrairCoordenadas(dispositivo);
        if (!coordenadas) return null;
        const nome = extrairNomeDispositivo(dispositivo);
        const placa = extrairPlaca(dispositivo);
        const grupo = extrairGrupo(dispositivo);
        const local = extrairLocal(dispositivo);
        const velocidade = extrairVelocidade(dispositivo);
        const atualizadoEm = formatarDataHora(extrairAtualizacao(dispositivo));
        const online = extrairOnline(dispositivo);
        const altitude = extrairAltitude(dispositivo);

        return {
          id: obterIdentificador(dispositivo, index),
          nome,
          placa,
          grupo,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
          local,
          velocidade,
          atualizadoEm,
          online,
          altitude,
        } satisfies PontoMapa;
      })
      .filter((item): item is PontoMapa => Boolean(item));
  }, [dispositivosFiltrados]);

  useEffect(() => {
    setSelecionados((prev) => {
      const validos = new Set(dispositivosMapeaveis.map((item) => item.id));
      const next = new Set([...prev].filter((id) => validos.has(id)));
      return next;
    });
  }, [dispositivosMapeaveis]);

  const pontosParaMapa = useMemo(() => {
    if (modoMapa === 'todos') return dispositivosMapeaveis;
    return dispositivosMapeaveis.filter((ponto) => selecionados.has(ponto.id));
  }, [dispositivosMapeaveis, modoMapa, selecionados]);

  const totalSemLocalizacao = Math.max(
    dispositivosFiltrados.length - dispositivosMapeaveis.length,
    0
  );

  const selecionarTodos = () => {
    setSelecionados(new Set(dispositivosMapeaveis.map((item) => item.id)));
  };

  const limparSelecao = () => {
    setSelecionados(new Set());
  };

  const alternarSelecao = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-green-800">Mapa dos veiculos</h2>
            <p className="text-xs text-gray-500">
              Visualize as localizacoes pelo OpenStreetMap.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-green-200 bg-green-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setModoMapa('todos')}
              className={`rounded px-3 py-1 font-semibold transition-colors ${
                modoMapa === 'todos'
                  ? 'bg-green-600 text-white'
                  : 'text-green-700 hover:bg-green-100'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setModoMapa('selecionados')}
              className={`rounded px-3 py-1 font-semibold transition-colors ${
                modoMapa === 'selecionados'
                  ? 'bg-green-600 text-white'
                  : 'text-green-700 hover:bg-green-100'
              }`}
            >
              Selecionados
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MapaVeiculos pontos={pontosParaMapa} />
            {pontosParaMapa.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {modoMapa === 'selecionados'
                  ? 'Selecione os veiculos que deseja visualizar no mapa.'
                  : 'Nenhum veiculo com localizacao disponivel para os filtros atuais.'}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              {dispositivosMapeaveis.length} veiculo(s) com coordenadas.
              {totalSemLocalizacao > 0 &&
                ` ${totalSemLocalizacao} sem localizacao.`}
            </div>

            {modoMapa === 'selecionados' ? (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selecionarTodos}
                    className="text-green-700 hover:text-green-900"
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    onClick={limparSelecao}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Limpar
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border border-green-100 divide-y divide-green-100">
                  {dispositivosMapeaveis.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500">
                      Nenhum veiculo com localizacao disponivel.
                    </div>
                  ) : (
                    dispositivosMapeaveis.map((ponto) => (
                      <label
                        key={ponto.id}
                        className="flex items-start gap-2 p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(ponto.id)}
                          onChange={() => alternarSelecao(ponto.id)}
                          className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {ponto.nome}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {ponto.placa}
                            {ponto.grupo && ponto.grupo !== '-'
                              ? ` • ${ponto.grupo}`
                              : ''}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">
                Mostrando todos os veiculos filtrados com coordenadas.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md">
        {carregando ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : dispositivosFiltrados.length === 0 ? (
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
                {dispositivosFiltrados.map((dispositivo, index) => {
                  const placa = extrairPlaca(dispositivo);
                  const nome = extrairNomeDispositivo(dispositivo);
                  const grupo = extrairGrupo(dispositivo);
                  const motorista = extrairMotorista(dispositivo);
                  const local = extrairLocal(dispositivo);
                  const velocidade = extrairVelocidade(dispositivo);
                  const online = extrairOnline(dispositivo);
                  const atualizadoEm = formatarDataHora(extrairAtualizacao(dispositivo));
                  const coordenadas = extrairCoordenadas(dispositivo);
                  const urlMapa = coordenadas ? montarUrlMapa(coordenadas) : '';

                  return (
                    <tr key={dispositivo.id || `${placa}-${index}`} className="border-t">
                      <td className="p-3 text-gray-900 font-medium">{placa}</td>
                      <td className="p-3 text-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{nome}</span>
                          {coordenadas ? (
                            <a
                              href={urlMapa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-md border border-green-600 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50"
                            >
                              Ver no mapa
                            </a>
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
                      <td className="p-3 text-gray-900">{grupo}</td>
                      <td className="p-3 text-gray-900">{motorista}</td>
                      <td className="p-3 text-gray-900">{local}</td>
                      <td className="p-3 text-gray-900">
                        {velocidade !== null ? `${velocidade} km/h` : '-'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            online
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-900">{atualizadoEm}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
