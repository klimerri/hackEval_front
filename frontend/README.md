# HackAuth — frontend

React SPA (Vite + TypeScript + Tailwind + shadcn/ui) для сервиса автоматической
оценки решений команд на хакатонах.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
```

В dev-режиме запросы `/api` проксируются на бэкенд `http://localhost:8000`
(см. `vite.config.ts`). Поднимите бэкенд из `../backend` через Docker.

## Сборка

```bash
npm run build
```

Подробнее об архитектуре и API — в корневом `../README.md`.
