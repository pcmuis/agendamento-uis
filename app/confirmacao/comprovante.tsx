'use client';

import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiX, FiChevronDown, FiChevronUp, FiShare2, FiCopy, FiClock, FiCalendar, FiUser, FiPhone, FiMapPin, FiTruck } from 'react-icons/fi';

type ComprovanteProps = {
  agendamento: {
    codigo: string;
    motorista: string;
    matricula: string;
    telefone: string;
    destino: string;
    observacoes?: string;
    veiculo: string;
    placa?: string;
    saida: string;
    chegada: string;
  };
  onClose: () => void;
};



export default function Comprovante({ agendamento, onClose }: ComprovanteProps) {
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState<boolean>(false);
  const [copiado, setCopiado] = useState<boolean>(false);
  

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
      'Retire a chave do veículo na balança da UIS',
      'Não será permitido retirar veículo diferente do agendado',
      'Verifique o estado do veículo (combustível, pneus, lataria) antes de sair',
      'Confira os documentos do veículo e equipamentos obrigatórios'
    ],
    utilizacao: [
      'Utilize o diário de bordo, registrando inicio e fim de uso',
      'Mantenha o veículo limpo e em boas condições',
      'Respeite os limites de velocidade e leis de trânsito',
      'Use o veículo apenas para o destino informado no agendamento'
    ],
    devolucao: [
      'Devolva o veículo no pátio da UIS no horário agendado e deixe a chave na balança',
      'Registre o fim do uso no diário de bordo',
      'Certifique-se de que o tanque está com o mesmo nível de combustível',
      'Informe qualquer ocorrência ou dano ao responsável ou PCM 45 99127-6269'
    ],
    emergencia: [
      'Em caso de acidente: acione o serviço de emergência (192/193) e notifique imediatamente o gestor da frota (45 99856-2656 - Willian Cristian)',
      'Problemas mecânicos: entre em contato com o gestor da frota imediatamente',
      'Emergências médicas: acione os serviços de emergência (192/193) e comunique a UIS.',
    ]
  };

  const generateComprovanteText = () => {
    return `📋 *COMPROVANTE DE AGENDAMENTO* 📋\n\n` +
      `*Código do comprovante*: ${agendamento.codigo}\n` +
      `🚗 *Veículo*: ${agendamento.veiculo} (${agendamento.placa || 'Placa não informada'})\n` +
      `👤 *Motorista*: ${agendamento.motorista}\n` +
      `🆔 *Matrícula*: ${agendamento.matricula}\n` +
      `📞 *Contato*: ${agendamento.telefone}\n\n` +
      `📅 *Período de Uso*\n` +
      `⏰ Saída: ${new Date(agendamento.saida).toLocaleString('pt-BR')}\n` +
      `⏰ Retorno: ${new Date(agendamento.chegada).toLocaleString('pt-BR')}\n\n` +
      `📍 *Destino*: ${agendamento.destino}\n` +
      `${agendamento.observacoes ? `📝 *Observações*: ${agendamento.observacoes}\n\n` : '\n'}`
  };

  const handleCopiar = async () => {
    const texto = generateComprovanteText();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert('Falha ao copiar o texto. Tente novamente.');
    }
  };

  const handleCompartilhar = async () => {
    const texto = generateComprovanteText();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Comprovante de Agendamento de Veículo',
          text: texto
        });
      } else {
        handleCopiar();
        alert('Web Share não suportado. Texto copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
      handleCopiar();
      alert('Erro ao compartilhar. Texto copiado para a área de transferência!');
    }
  };

  const handleCompartilharWhatsApp = () => {
    const texto = encodeURIComponent(generateComprovanteText());
    const numeroWhatsApp = '+5545998562656'; // Número editável, celular do PCM
    const url = `https://wa.me/${numeroWhatsApp}?text=${texto}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overscroll-contain">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="bg-green-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FiCheckCircle className="text-xl" />
            <h2 className="text-lg font-bold">Agendamento Confirmado</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-green-100 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Alerta importante */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-bold">Atenção:</span> Apresente este comprovante no momento da retirada do veículo.
                </p>
              </div>
            </div>
          </div>

          {/* Dados do agendamento */}
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <FiTruck className="text-lg" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Veículo</h3>
                <p className="text-sm font-semibold text-gray-900">
                  {agendamento.veiculo} {agendamento.placa && `(${agendamento.placa})`}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <FiUser className="text-lg" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Motorista</h3>
                <p className="text-sm font-semibold text-gray-900">{agendamento.motorista}</p>
                <p className="text-xs text-gray-500">Matrícula: {agendamento.matricula}</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <FiPhone className="text-lg" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Contato</h3>
                <p className="text-sm font-semibold text-gray-900">{agendamento.telefone}</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <FiMapPin className="text-lg" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Destino</h3>
                <p className="text-sm font-semibold text-gray-900">{agendamento.destino}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <FiCalendar className="text-lg" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">Data de Saída</h3>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(agendamento.saida).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(agendamento.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <FiClock className="text-lg" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">Data de Retorno</h3>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(agendamento.chegada).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(agendamento.chegada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>

            {agendamento.observacoes && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Observações</h3>
                <p className="text-sm text-gray-700">{agendamento.observacoes}</p>
              </div>
            )}
          </div>

          {/* Instruções */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setMostrarInstrucoes(!mostrarInstrucoes)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-green-600 hover:text-green-800 focus:outline-none"
            >
              <span>Instruções para uso do veículo</span>
              {mostrarInstrucoes ? (
                <FiChevronUp className="h-5 w-5" />
              ) : (
                <FiChevronDown className="h-5 w-5" />
              )}
            </button>

            <div className={`mt-2 space-y-4 text-sm text-gray-500 ${mostrarInstrucoes ? 'block' : 'hidden'}`}>
              <div>
                <h4 className="font-medium text-gray-700 flex items-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 mr-2">
                    1
                  </span>
                  Retirada do Veículo
                </h4>
                <ul className="mt-2 pl-8 space-y-1 list-disc">
                  {instrucoes.retirada.map((item, i) => (
                    <li key={`retirada-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 flex items-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 mr-2">
                    2
                  </span>
                  Durante a Utilização
                </h4>
                <ul className="mt-2 pl-8 space-y-1 list-disc">
                  {instrucoes.utilizacao.map((item, i) => (
                    <li key={`uso-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 flex items-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 mr-2">
                    3
                  </span>
                  Devolução
                </h4>
                <ul className="mt-2 pl-8 space-y-1 list-disc">
                  {instrucoes.devolucao.map((item, i) => (
                    <li key={`devolucao-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 flex items-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 mr-2">
                    4
                  </span>
                  Emergências
                </h4>
                <ul className="mt-2 pl-8 space-y-1 list-disc">
                  {instrucoes.emergencia.map((item, i) => (
                    <li key={`emergencia-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="bg-gray-50 px-4 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-0 sm:px-6 rounded-b-xl">
          <button
            onClick={handleCompartilhar}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none w-full sm:w-auto"
          >
            <FiShare2 className="-ml-0.5 mr-2 h-4 w-4" />
            Compartilhar
          </button>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <button
              onClick={handleCopiar}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none w-full sm:w-auto"
            >
              <FiCopy className="-ml-0.5 mr-2 h-4 w-4" />
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            
            <button
              onClick={handleCompartilharWhatsApp}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none w-full sm:w-auto"
            >
              <svg className="-ml-0.5 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.134.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.318-1.66a11.955 11.955 0 005.684 1.44h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
