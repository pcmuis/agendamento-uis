'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dispositivo3Sat, listarDispositivos } from '@/app/lib/3sat';

type Filtros = {
  termo: string;
  grupo: string;
  local: string;
  somenteOnline: boolean;
};

const normalizarTexto = (valor?: string) => (valor || '').toLowerCase();

const formatarDataHora = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR');
};

const extrairPlaca = (dispositivo: Dispositivo3Sat) =>
  dispositivo.plate ||
  dispositivo.deviceGpsDataSingle?.plate ||
  dispositivo.lastDeviceGps?.plate ||
  '-';

const extrairNomeDispositivo = (dispositivo: Dispositivo3Sat) =>
  dispositivo.deviceName ||
  dispositivo.name ||
  dispositivo.deviceGpsDataSingle?.deviceName ||
  dispositivo.lastDeviceGps?.deviceName ||
  '-';

const extrairGrupo = (dispositivo: Dispositivo3Sat) =>
  dispositivo.deviceGroupName || dispositivo.groupName || '-';

const extrairMotorista = (dispositivo: Dispositivo3Sat) =>
  dispositivo.driverName ||
  dispositivo.deviceGpsDataSingle?.driverName ||
  dispositivo.lastDeviceGps?.driverName ||
  dispositivo.lastMessage?.driver?.name ||
  '-';

const extrairLocal = (dispositivo: Dispositivo3Sat) => {
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
    enderecoGps ||
    enderecoMsg ||
    [rua, numero].filter(Boolean).join(' ') ||
    cidade ||
    '-'
  );
};

const extrairVelocidade = (dispositivo: Dispositivo3Sat) =>
  dispositivo.deviceGpsDataSingle?.speed ?? dispositivo.lastDeviceGps?.speed ?? null;

const extrairAtualizacao = (dispositivo: Dispositivo3Sat) =>
  dispositivo.deviceGpsDataSingle?.localCreationTime ||
  dispositivo.deviceGpsDataSingle?.dateTime ||
  dispositivo.lastDeviceGps?.localCreationTime ||
  dispositivo.lastMessage?.localPositionDateTime ||
  undefined;

const extrairOnline = (dispositivo: Dispositivo3Sat) => {
  const onlineGps = dispositivo.deviceGpsDataSingle?.isOnline;
  const onlineUltimo = dispositivo.lastDeviceGps?.isOnline;
  const onlineMensagem = dispositivo.lastMessage?.network?.online;
  if (typeof onlineGps === 'boolean') return onlineGps;
  if (typeof onlineUltimo === 'boolean') return onlineUltimo;
  if (typeof onlineMensagem === 'boolean') return onlineMensagem;
  return false;
};

export default function Rastreamento3SatPage() {
  const [dispositivos, setDispositivos] = useState<Dispositivo3Sat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({
    termo: '',
    grupo: '',
    local: '',
    somenteOnline: false,
  });

  const carregarDispositivos = async () => {
    setErro('');
    setCarregando(true);
    try {
      const dados = await listarDispositivos();
      setDispositivos(Array.isArray(dados) ? dados : []);
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

                  return (
                    <tr key={dispositivo.id || `${placa}-${index}`} className="border-t">
                      <td className="p-3 text-gray-900 font-medium">{placa}</td>
                      <td className="p-3 text-gray-900">{nome}</td>
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
