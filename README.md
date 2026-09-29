# LinkBoost V1

Primeira versão funcional local do LinkBoost.

## O que funciona
- painel web responsivo;
- API local em Node.js, sem dependências externas;
- persistência em `data.json`;
- adicionar/excluir produtos por link da Shopee;
- identificar ID numérico quando ele existir na URL;
- adicionar/excluir/ativar grupos;
- configurar quantidade de posts por dia e horários;
- gerar 3 variações de legenda por produto;
- colocar legenda + produto + grupo + horário na fila;
- visualizar e excluir posts da fila;
- status de configuração das credenciais no servidor.

## Rodar
1. Instale Node.js 18 ou superior.
2. Abra o terminal nesta pasta.
3. Execute `node server.js`.
4. Abra `http://localhost:3000` no navegador.

## APIs reais
O arquivo `.env.example` mostra onde entram as credenciais. Os segredos não devem ser colocados no HTML.

A V1 ainda não publica automaticamente em grupos do Facebook e não consulta automaticamente todos os dados do produto na Shopee. Ela deixa a base pronta para os adaptadores oficiais.
