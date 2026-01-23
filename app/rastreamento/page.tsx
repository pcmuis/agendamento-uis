export default function RastreamentoPage() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold text-green-800">
          Central de Rastreamento
        </h1>
        <p className="text-sm text-green-700 mt-2">
          Use o menu lateral para acessar integracoes e relatorios de
          rastreamento.
        </p>
      </header>

      <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 shadow-md">
        <h2 className="text-lg font-medium text-green-700 mb-2">
          Integracao 3SAT
        </h2>
        <p className="text-sm text-gray-600">
          Consulte posicoes, eventos e outras informacoes diretamente pela API
          da 3SAT usando sua credencial.
        </p>
      </div>
    </section>
  );
}
