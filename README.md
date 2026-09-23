# VX Leads

App de prospecção local por região, com busca de negócios, lista de telefones, leads salvos e dashboard.

## Executar localmente

- Node.js 22.13 ou superior
- Instale dependências com `npm install`
- Inicie com `npm run dev`
- Gere build de produção com `npm run build`

## Vercel

Importe este repositório e mantenha a raiz do projeto como diretório raiz. Use Node.js 22.x ou superior e o comando padrão `npm run build`.

O site abre sem arquivo `.env`, mas alguns recursos precisam de variáveis no painel da Vercel:

- `RESEND_API_KEY`, `AUTH_FROM_EMAIL` e `AUTH_VERIFICATION_SECRET` para enviar/verificar códigos por e-mail.
- `GOOGLE_MAPS_API_KEY` para buscas no servidor; também é possível configurar a chave do Maps dentro do app.

Nunca publique valores dessas chaves no GitHub. Dados salvos no navegador ficam neste dispositivo, pois o app não usa banco de dados remoto.
