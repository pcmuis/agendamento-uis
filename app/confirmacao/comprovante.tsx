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
    saida: string;
    chegada: string;
    vagas: number;
  };
  onClose: () => void;
};

export default function Comprovante({ agendamento, onClose }: ComprovanteProps) {
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState<boolean>(false);

  // Fechar modal com tecla Esc
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Instruções para retirada, zelo, condução e devolução
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

  // Enviar comprovante para WhatsApp
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

  // Copiar comprovante para a área de transferência
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-transform duration-300 scale-100 hover:scale-105">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-green-800">Comprovante de Agendamento</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Fechar"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="space-y-3 text-sm sm:text-base text-gray-700">
          <p><span className="font-medium text-green-700">Motorista:</span> {agendamento.motorista}</p>
          <p><span className="font-medium text-green-700">Matrícula:</span> {agendamento.matricula}</p>
          <p><span className="font-medium text-green-700">Telefone:</span> {agendamento.telefone}</p>
          <p><span className="font-medium text-green-700">Destino:</span> {agendamento.destino}</p>
          {agendamento.observacoes && (
            <p><span className="font-medium text-green-700">Observações:</span> {agendamento.observacoes}</p>
          )}
          <p><span className="font-medium text-green-700">Veículo:</span> {agendamento.veiculo}</p>
          <p><span className="font-medium text-green-700">Saída:</span> {new Date(agendamento.saida).toLocaleString('pt-BR')}</p>
          <p><span className="font-medium text-green-700">Chegada:</span> {new Date(agendamento.chegada).toLocaleString('pt-BR')}</p>
          <p><span className="font-medium text-green-700">Vagas:</span> {agendamento.vagas}</p>
        </div>
        <div className="mt-6">
          <button
            onClick={() => setMostrarInstrucoes(!mostrarInstrucoes)}
            className="flex items-center w-full bg-green-100 text-green-700 py-2 px-4 rounded-md hover:bg-green-200 transition-colors duration-200 text-sm sm:text-base"
          >
            {mostrarInstrucoes ? (
              <FaChevronUp className="mr-2" />
            ) : (
              <FaChevronDown className="mr-2" />
            )}
            {mostrarInstrucoes ? 'Ocultar Instruções' : 'Mostrar Instruções'}
          </button>
          {mostrarInstrucoes && (
            <div className="mt-4 space-y-4 text-sm sm:text-base text-gray-700">
              <div>
                <h3 className="font-medium text-green-700">1. Retirada</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {instrucoes.retirada.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-green-700">2. Zelo</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {instrucoes.zelo.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-green-700">3. Condução</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {instrucoes.conducao.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-green-700">4. Devolução</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {instrucoes.devolucao.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleCopiar}
            className="flex items-center justify-center bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors duration-200 text-sm sm:text-base"
          >
            <FaCopy className="mr-2" />
            Copiar
          </button>
          <button
            onClick={handleEnviarWhatsApp}
            className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base"
          >
            <FaWhatsapp className="mr-2" />
            Enviar para WhatsApp
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors duration-200 text-sm sm:text-base"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}