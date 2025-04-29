import ProtectedRoute from '../components/ProtectedRoute';

export default function AdministracaoPage() {
    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-green-50 p-4 sm:p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-6 sm:mb-8">
                        Painel de Administração
                    </h1>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Card Veículos */}
                        <a 
                            href="/veiculos" 
                            className="bg-white p-6 rounded-lg shadow-md border border-green-200 hover:shadow-lg transition-shadow duration-200"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-green-700">Veículos</h2>
                                    <p className="text-sm text-gray-600">Gerencie a frota de veículos disponíveis</p>
                                </div>
                            </div>
                        </a>

                        {/* Card Gerenciar Agendamentos */}
                        <a 
                            href="/gerenciar-agendamentos" 
                            className="bg-white p-6 rounded-lg shadow-md border border-green-200 hover:shadow-lg transition-shadow duration-200"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-green-700">Gerenciar Agendamentos</h2>
                                    <p className="text-sm text-gray-600">Aprove, edite ou cancele agendamentos</p>
                                </div>
                            </div>
                        </a>

                        {/* Card Motoristas */}
                        <a 
                            href="/motoristas" 
                            className="bg-white p-6 rounded-lg shadow-md border border-green-200 hover:shadow-lg transition-shadow duration-200"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-green-700">Motoristas</h2>
                                    <p className="text-sm text-gray-600">Gerencie os motoristas autorizados do sistema</p>
                                </div>
                            </div>
                        </a>

                        {/* Card Relatórios */}
                        <a 
                            href="/relatorios" 
                            className="bg-white p-6 rounded-lg shadow-md border border-green-200 hover:shadow-lg transition-shadow duration-200"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-green-700">Relatórios</h2>
                                    <p className="text-sm text-gray-600">Acesse relatórios e estatísticas do sistema</p>
                                </div>
                            </div>
                        </a>

                        {/* Card Histórico de Uso dos Veículos */}
                        <a 
                            href="/historico" 
                            className="bg-white p-6 rounded-lg shadow-md border border-green-200 hover:shadow-lg transition-shadow duration-200"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8m-4-4v8m8-8a8 8 0 11-16 0 8 8 0 0116 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium text-green-700">Histórico de Veículos</h2>
                                    <p className="text-sm text-gray-600">Visualize e gerencie o histórico de uso</p>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
}