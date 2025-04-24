'use client';

import React, { useEffect, useState } from 'react';
import { FaWhatsapp, FaCopy, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';

type ComprovanteProps = {
  agendamento: {
    motorista: string;
    matricula: string;
    telefone: string;
    destino: string;
    observacoes?: string;
    veiculo: string;
    placa?: string;
    saida: string;
    chegada: string;
    vagas: number;
  };
  onClose: () => void;
};

export default function Comprovante({ agendamento, onClose }: ComprovanteProps) {
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState<boolean>(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const instrucoes = {
    retirada: [
      'Retire o veículo na garagem central (endereço: [inserir endereço]) no horário agendado.',
      'Apresente documento de identificação e matrícula ao responsável.',
      'Verifique o estado do veículo (combustível, pneus, lataria) e reporte qualquer problema antes de sair.',
    ],
    zelo: [
      'Mantenha o veículo limpo e em boas condições.',
      'Não fume ou consuma alimentos/bebidas que possam sujar o interior.',
      'Evite sobrecarregar o veículo com peso excessivo.',
    ],
    conducao: [
      'Respeite as leis de trânsito e os limites de velocidade.',
      'Dirija com atenção, evitando distrações (ex.: uso de celular).',
      'Use cinto de segurança para todos os ocupantes.',
    ],
    devolucao: [
      'Devolva o veículo no mesmo local de retirada até o horário de chegada agendado.',
      'Abasteça o tanque ao nível inicial, se aplicável.',
      'Informe qualquer dano ou problema ocorrido durante o uso.',
    ],
  };

  const handleEnviarWhatsApp = () => {
    const mensagem = `📋 *Comprovante de Agendamento de Veículo*\n\n` +
      `👤 *Motorista*: ${agendamento.motorista}\n` +
      `🆔 *Matrícula*: ${agendamento.matricula}\n` +
      `📞 *Telefone*: ${agendamento.telefone}\n` +
      `📍 *Destino*: ${agendamento.destino}\n` +
      `${agendamento.observacoes ? `📝 *Observações*: ${agendamento.observacoes}\n` : ''}` +
      `🚗 *Veículo*: ${agendamento.veiculo}\n` +
      `📅 *Saída*: ${new Date(agendamento.saida).toLocaleString('pt-BR')}\n` +
      `📅 *Chegada*: ${new Date(agendamento.chegada).toLocaleString('pt-BR')}\n` +
      `👥 *Vagas*: ${agendamento.vagas}\n\n` +
      `📜 *Instruções*\n` +
      `1️⃣ *Retirada*:\n${instrucoes.retirada.map((item) => `- ${item}`).join('\n')}\n` +
      `2️⃣ *Zelo*:\n${instrucoes.zelo.map((item) => `- ${item}`).join('\n')}\n` +
      `3️⃣ *Condução*:\n${instrucoes.conducao.map((item) => `- ${item}`).join('\n')}\n` +
      `4️⃣ *Devolução*:\n${instrucoes.devolucao.map((item) => `- ${item}`).join('\n')}`;

    const url = `https://wa.me/45998394505?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const handleCopiar = () => {
    const texto = `Comprovante de Agendamento de Veículo\n\n` +
      `Motorista: ${agendamento.motorista}\n` +
      `Matrícula: ${agendamento.matricula}\n` +
      `Telefone: ${agendamento.telefone}\n` +
      `Destino: ${agendamento.destino}\n` +
      `${agendamento.observacoes ? `Observações: ${agendamento.observacoes}\n` : ''}` +
      `Veículo: ${agendamento.veiculo}\n` +
      `Saída: ${new Date(agendamento.saida).toLocaleString('pt-BR')}\n` +
      `Chegada: ${new Date(agendamento.chegada).toLocaleString('pt-BR')}\n` +
      `Vagas: ${agendamento.vagas}\n\n` +
      `Instruções\n` +
      `1. Retirada:\n${instrucoes.retirada.map((item) => `- ${item}`).join('\n')}\n` +
      `2. Zelo:\n${instrucoes.zelo.map((item) => `- ${item}`).join('\n')}\n` +
      `3. Condução:\n${instrucoes.conducao.map((item) => `- ${item}`).join('\n')}\n` +
      `4. Devolução:\n${instrucoes.devolucao.map((item) => `- ${item}`).join('\n')}`;

    navigator.clipboard.writeText(texto).then(() => {
      alert('Comprovante e instruções copiados para a área de transferência!');
    }).catch((err) => {
      console.error('Erro ao copiar:', err);
      alert('Erro ao copiar o comprovante. Tente novamente.');
    });
  };

  return (
    <div className="fixed inset-0 bg-green-50 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-11/12 max-w-lg max-h-[90vh] overflow-y-auto mx-4 transform transition-transform duration-300 scale-100 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-green-800">Comprovante de Agendamento</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Fechar comprovante"
          >
            <FaTimes size={18} />
          </button>
        </div>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mb-6">
          <p className="text-sm sm:text-base font-medium">
            ⚠️ Atenção: Você deve enviar este comprovante para o WhatsApp para validar o agendamento.
          </p>
        </div>
        <div className="space-y-2 text-sm sm:text-base text-gray-700">
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Motorista:</span>
            <span className="text-wrap">{agendamento.motorista}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Matrícula:</span>
            <span className="text-wrap">{agendamento.matricula}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Telefone:</span>
            <span className="text-wrap">{agendamento.telefone}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Destino:</span>
            <span className="text-wrap">{agendamento.destino}</span>
          </p>
          {agendamento.observacoes && (
            <p className="flex flex-wrap">
              <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Observações:</span>
              <span className="text-wrap">{agendamento.observacoes}</span>
            </p>
          )}
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Veículo:</span>
            <span className="text-wrap">{agendamento.veiculo}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Placa:</span>
            <span className="text-wrap">{agendamento.placa}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Saída:</span>
            <span className="text-wrap">{new Date(agendamento.saida).toLocaleString('pt-BR')}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Chegada:</span>
            <span className="text-wrap">{new Date(agendamento.chegada).toLocaleString('pt-BR')}</span>
          </p>
          <p className="flex flex-wrap">
            <span className="font-medium text-green-700 w-24 sm:w-28 shrink-0">Vagas:</span>
            <span className="text-wrap">{agendamento.vagas}</span>
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={() => setMostrarInstrucoes(!mostrarInstrucoes)}
            className="flex items-center w-full bg-green-100 text-green-700 py-2 px-3 rounded-md hover:bg-green-200 transition-colors duration-200 text-sm sm:text-base"
            aria-expanded={mostrarInstrucoes}
          >
            {mostrarInstrucoes ? (
              <FaChevronUp className="mr-2" />
            ) : (
              <FaChevronDown className="mr-2" />
            )}
            {mostrarInstrucoes ? 'Ocultar Instruções' : 'Mostrar Instruções'}
          </button>
          <div
            className={`mt-3 space-y-3 text-sm sm:text-base text-gray-700 transition-all duration-300 ease-in-out ${
              mostrarInstrucoes ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div>
              <h3 className="font-medium text-green-700">1. Retirada</h3>
              <ul className="list-disc pl-5 space-y-1 text-wrap">
                {instrucoes.retirada.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-green-700">2. Zelo</h3>
              <ul className="list-disc pl-5 space-y-1 text-wrap">
                {instrucoes.zelo.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-green-700">3. Condução</h3>
              <ul className="list-disc pl-5 space-y-1 text-wrap">
                {instrucoes.conducao.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-green-700">4. Devolução</h3>
              <ul className="list-disc pl-5 space-y-1 text-wrap">
                {instrucoes.devolucao.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="fixed top-1/3 right-4 flex flex-col gap-3 z-50">
          <button
            onClick={handleEnviarWhatsApp}
            className="flex items-center justify-center bg-green-500 text-white p-3 rounded-full shadow-md hover:bg-green-600 transition-colors duration-200"
            aria-label="Compartilhar no WhatsApp"
          >
            <FaWhatsapp size={20} />
          </button>
          <button
            onClick={handleCopiar}
            className="flex items-center justify-center bg-gray-500 text-white p-3 rounded-full shadow-md hover:bg-gray-600 transition-colors duration-200"
            aria-label="Copiar Comprovante"
          >
            <FaCopy size={20} />
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center bg-red-500 text-white p-3 rounded-full shadow-md hover:bg-red-600 transition-colors duration-200"
            aria-label="Fechar"
          >
            <FaTimes size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}