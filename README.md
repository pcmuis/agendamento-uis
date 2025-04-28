# Sistema de Agendamento de Veículos - UIS

Este é um sistema de gerenciamento de agendamentos de veículos desenvolvido com [Next.js](https://nextjs.org), [TypeScript](https://www.typescriptlang.org/), [Firebase](https://firebase.google.com/), e [Tailwind CSS](https://tailwindcss.com/). Ele permite que usuários agendem veículos, gerenciem agendamentos, e acompanhem o histórico de uso.

## Funcionalidades

- **Agendamento de Veículos**: Permite que usuários solicitem agendamentos de veículos com informações detalhadas.
- **Gerenciamento de Veículos**: Administra a frota de veículos, incluindo criação, edição e exclusão.
- **Histórico de Uso**: Visualiza e gerencia o histórico de agendamentos de veículos.
- **Painel Administrativo**: Acesso a ferramentas de administração, como gerenciamento de usuários e relatórios.
- **Exportação para Excel**: Exporta dados de agendamentos para arquivos Excel.
- **Autenticação**: Sistema de login para proteger rotas administrativas.

## Tecnologias Utilizadas

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Firebase Firestore
- **Outras Bibliotecas**: React Icons, XLSX

## Pré-requisitos

Certifique-se de ter as seguintes ferramentas instaladas:

- Node.js (versão 16 ou superior)
- npm, yarn, pnpm ou bun (gerenciador de pacotes)
- Firebase configurado com as credenciais no arquivo `firebase.ts`

## Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/agendamento-uis.git
   cd agendamento-uis
   ```

2. Instale as dependências:

   ```bash
   npm install
   # ou
   yarn install
   # ou
   pnpm install
   ```

3. Configure o Firebase:

   - Atualize o arquivo `app/lib/firebase.ts` com as credenciais do seu projeto Firebase.

4. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   # ou
   yarn dev
   # ou
   pnpm dev
   ```

5. Acesse o sistema em [http://localhost:3000](http://localhost:3000).

## Estrutura do Projeto

- **`app/`**: Contém as páginas e componentes do sistema.
  - **`components/`**: Componentes reutilizáveis, como `ProtectedRoute`.
  - **`context/`**: Contexto de autenticação.
  - **`lib/`**: Funções auxiliares para interagir com o Firebase.
- **`public/`**: Arquivos estáticos.
- **`styles/`**: Arquivos de estilo global.
- **`types.ts`**: Definições de tipos TypeScript.

## Scripts Disponíveis

- `dev`: Inicia o servidor de desenvolvimento.
- `build`: Compila o projeto para produção.
- `start`: Inicia o servidor de produção.
- `lint`: Verifica problemas de lint no código.

## Funcionalidades Detalhadas

### Agendamento de Veículos

- Acesse a página de agendamento em `/agendar`.
- Preencha os detalhes do agendamento, como data de saída, chegada, veículo, motorista, etc.
- Receba um comprovante com as informações do agendamento.

### Gerenciamento de Veículos

- Acesse a página de veículos em `/veiculos`.
- Adicione, edite ou remova veículos.
- Verifique a disponibilidade de cada veículo.

### Histórico de Uso

- Acesse o histórico em `/historico`.
- Visualize os registros de uso dos veículos.
- Exclua registros antigos, se necessário.

### Painel Administrativo

- Acesse o painel em `/administracao`.
- Navegue para gerenciar veículos, agendamentos, usuários e relatórios.

## Exportação para Excel

- Na página de gerenciamento de agendamentos, clique no botão "Exportar para Excel" para baixar os dados em formato `.xlsx`.

## Autenticação

- O sistema utiliza autenticação básica para proteger rotas administrativas.
- Credenciais padrão:
  - Usuário: `admin`
  - Senha: `admin123`

## Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.

## Contribuição

Contribuições são bem-vindas! Siga os passos abaixo para contribuir:

1. Faça um fork do repositório.
2. Crie uma branch para sua feature ou correção de bug: `git checkout -b minha-feature`.
3. Faça commit das suas alterações: `git commit -m 'Adiciona minha feature'`.
4. Envie para o repositório remoto: `git push origin minha-feature`.
5. Abra um Pull Request.

## Contato

Para dúvidas ou sugestões, entre em contato com o desenvolvedor:

- **Nome**: Marcos Gimenes
- **Email**: marcosgimenesdev@gmail.com
- **GitHub**: [github.com/MarcosFGimenes](https://github.com/MarcosFGimenes)
