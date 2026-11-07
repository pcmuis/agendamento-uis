'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, setupCredentials, credentialStatus } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (credentialStatus !== 'configured' && credentialStatus !== 'unconfigured') {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      if (credentialStatus === 'unconfigured') {
        await setupCredentials(username, password);
      } else {
        await login(username, password);
      }
      router.push('/administracao');
    } catch (err) {
      if (err instanceof Error && err.message.includes('já foram cadastradas')) {
        setError('As credenciais já foram cadastradas. Atualize a página para entrar.');
      } else if (credentialStatus === 'unconfigured') {
        setError('Não foi possível cadastrar as credenciais. Tente novamente.');
      } else {
        setError('Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md border border-green-200 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-green-800 mb-6 text-center">
          {credentialStatus === 'unconfigured' ? 'Primeiro acesso' : 'Acesso Administrativo'}
        </h1>

        {credentialStatus === 'unconfigured' && (
          <p className="text-sm text-green-800 mb-4 text-center">
            Nenhuma credencial de acesso cadastrada, realize o primeiro acesso
          </p>
        )}

        {credentialStatus === 'checking' && (
          <p role="status" className="text-sm text-green-800 mb-4 text-center">
            Verificando credenciais de acesso...
          </p>
        )}

        {credentialStatus === 'error' && (
          <p role="alert" className="text-sm text-red-700 mb-4 text-center">
            Não foi possível consultar o banco de dados. Tente novamente mais tarde.
          </p>
        )}
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-green-700 mb-1">
              Usuário
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-green-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={credentialStatus === 'checking' || credentialStatus === 'error' || submitting}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Salvando...'
              : credentialStatus === 'unconfigured'
                ? 'Cadastrar credenciais'
                : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}