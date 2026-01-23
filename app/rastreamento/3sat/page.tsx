'use client';

import { useState } from 'react';
import {
  consultarPosicaoPeriodo,
  consultarUltimaPosicao,
  Posicao3Sat,
} from '@/app/lib/3sat';

type PeriodoFiltro = {
  placa: string;
  inicio: string;
  fim: string;
};

function formatarDataHora(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR');
}

function PositionsTable({
  dados,
  vazioMensagem,
}: {
  dados: Posicao3Sat[] | null;
  vazioMensagem: string;
}) {
  if (!dados) return null;

  if (dados.length === 0) {
    return (
      <p className="text-sm text-gray-600">{vazioMensagem}</p>
    );
  }

  return (
    <div className="overflow-x-auto border border-green-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-green-100 text-green-700">
          <tr>
            <th className="p-3 text-left">Dispositivo</th>
            <th className="p-3 text-left">Motorista</th>
            <th className="p-3 text-left">Data/Hora</th>
            <th className="p-3 text-left">Latitude</th>
            <th className="p-3 text-left">Longitude</th>
            <th className="p-3 text-left">Velocidade</th>
            <th className="p-3 text-left">Endereco</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((item, index) => (
            <tr key={item.id || `${item.deviceId}-${index}`} className="border-t">
              <td className="p-3 text-gray-900">
                {item.deviceName || item.deviceId || '-'}
              </td>
              <td className="p-3 text-gray-900">
                {item.driverName || item.driverCode || '-'}
              </td>
              <td className="p-3 text-gray-900">
                {formatarDataHora(item.localDateTime || item.dateTime)}
              </td>
              <td className="p-3 text-gray-900">
                {item.latitude ?? '-'}
              </td>
              <td className="p-3 text-gray-900">
                {item.longitude ?? '-'}
              </td>
              <td className="p-3 text-gray-900">
                {item.speed ?? '-'}
              </td>
              <td className="p-3 text-gray-900">
                {item.address || item.addressString || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Rastreamento3SatPage() {
  const [token, setToken] = useState('');
  const [erro, setErro] = useState('');
  const [ultimaPosicao, setUltimaPosicao] = useState<Posicao3Sat[] | null>(null);
  const [posicaoPeriodo, setPosicaoPeriodo] = useState<Posicao3Sat[] | null>(null);
  const [carregandoUltima, setCarregandoUltima] = useState(false);
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    placa: '',
    inicio: '',
    fim: '',
  });

  const validarToken = () => {
    if (!token.trim()) {
      setErro('Informe a credencial da 3SAT para continuar.');
      return false;
    }
    return true;
  };

  const handleBuscarUltimaPosicao = async () => {
    setErro('');
    if (!validarToken()) return;
    setCarregandoUltima(true);
    try {
      const dados = await consultarUltimaPosicao(token.trim());
      setUltimaPosicao(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Erro ao consultar ultima posicao.'
      );
    } finally {
      setCarregandoUltima(false);
    }
  };

  const handleBuscarPosicaoPeriodo = async () => {
    setErro('');
    if (!validarToken()) return;

    if (!periodo.placa || !periodo.inicio || !periodo.fim) {
      setErro('Preencha placa, inicio e fim do periodo.');
      return;
    }

    const inicioData = new Date(periodo.inicio);
    const fimData = new Date(periodo.fim);

    if (Number.isNaN(inicioData.getTime()) || Number.isNaN(fimData.getTime())) {
      setErro('Datas invalidas. Verifique o periodo informado.');
      return;
    }

    if (inicioData > fimData) {
      setErro('A data inicial deve ser anterior a data final.');
      return;
    }

    setCarregandoPeriodo(true);
    try {
      const dados = await consultarPosicaoPeriodo(
        token.trim(),
        periodo.placa.trim(),
        inicioData.toISOString(),
        fimData.toISOString()
      );
      setPosicaoPeriodo(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Erro ao consultar posicao por periodo.'
      );
    } finally {
      setCarregandoPeriodo(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-green-800">
          Administracao 3SAT
        </h1>
        <p className="text-sm text-green-700 mt-2">
          Todas as requisicoes enviam a credencial no body do POST conforme a
          documentacao da API.
        </p>
      </header>

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-green-700 mb-1">
            Credencial 3SAT
          </label>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
            placeholder="Informe sua credencial"
          />
          <p className="text-xs text-gray-500 mt-1">
            A credencial e usada apenas para esta sessao e nao e armazenada.
          </p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-green-800">
              Ultima posicao
            </h2>
            <button
              onClick={handleBuscarUltimaPosicao}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
              disabled={carregandoUltima}
            >
              {carregandoUltima ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
          <PositionsTable
            dados={ultimaPosicao}
            vazioMensagem="Nenhuma posicao retornada ate o momento."
          />
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-green-800">
              Posicao por periodo
            </h2>
            <button
              onClick={handleBuscarPosicaoPeriodo}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
              disabled={carregandoPeriodo}
            >
              {carregandoPeriodo ? 'Consultando...' : 'Consultar'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                Placa
              </label>
              <input
                type="text"
                value={periodo.placa}
                onChange={(event) =>
                  setPeriodo((prev) => ({ ...prev, placa: event.target.value }))
                }
                className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
                placeholder="ABC1D23"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                Inicio
              </label>
              <input
                type="datetime-local"
                value={periodo.inicio}
                onChange={(event) =>
                  setPeriodo((prev) => ({ ...prev, inicio: event.target.value }))
                }
                className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                Fim
              </label>
              <input
                type="datetime-local"
                value={periodo.fim}
                onChange={(event) =>
                  setPeriodo((prev) => ({ ...prev, fim: event.target.value }))
                }
                className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900"
              />
            </div>
          </div>

          <PositionsTable
            dados={posicaoPeriodo}
            vazioMensagem="Nenhuma posicao encontrada para o periodo informado."
          />
        </div>
      </div>
    </section>
  );
}
