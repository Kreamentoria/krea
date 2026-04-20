# Argentina Renda Fixa

Aplicação fullstack para monitoramento de taxas de renda fixa da Argentina, com atualização automática via scraping do BCRA e INDEC.

## Estrutura

```
argentina-renda-fixa/
├── backend/          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── index.ts      # Entrypoint, cron, servidor
│   │   ├── routes.ts     # Endpoints REST
│   │   ├── scraper.ts    # Scraping BCRA / INDEC
│   │   ├── store.ts      # Estado em memória
│   │   └── types.ts      # Interfaces TypeScript
│   ├── package.json
│   └── tsconfig.json
└── frontend/         # React + Vite + TypeScript + Tailwind
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   ├── types.ts
    │   └── components/
    │       ├── RateCard.tsx
    │       └── RatesChart.tsx
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## Taxas monitoradas

| Taxa | Fonte | Descrição |
|---|---|---|
| **LELIQ** | BCRA | Letras de Liquidez do Banco Central |
| **Prazo Fixo** | BCRA | Taxa de depósito a prazo (30 dias) |
| **BADLAR** | BCRA | Taxa para grandes depósitos (> 1M ARS) |
| **Inflação** | INDEC | Variação mensal do IPC |

## Como rodar

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

O servidor sobe em `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

A aplicação abre em `http://localhost:5173`.  
O Vite faz proxy de `/api` para o backend automaticamente.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/rates` | Taxas atuais |
| GET | `/api/history` | Histórico (últimas 365 entradas) |
| POST | `/api/rates/refresh` | Força atualização imediata |
| GET | `/api/health` | Health check |

## Variáveis de ambiente (backend)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `NODE_ENV` | `development` | Ambiente |
| `CRON_SCHEDULE` | `0 * * * *` | Frequência de atualização (cron) |

## Build para produção

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
# Servir a pasta dist/ com qualquer servidor estático
```

## Tecnologias

**Backend:** Node.js · Express · TypeScript · Axios · Cheerio · node-cron · dotenv  
**Frontend:** React 18 · Vite · TypeScript · Tailwind CSS · Recharts · Axios
