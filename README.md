# Amigo Invisible

PWA para organizar sorteos de amigo invisible: grupos, invitaciones por WhatsApp, exclusiones, sorteo inmediato o programado, listas de deseos y resultados por email. Ver `CLAUDE.md` para los requisitos completos.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local      # rellena SESSION_SECRET, CRON_SECRET, etc.
docker compose up -d            # PostgreSQL 17 en localhost:5432
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Sin `RESEND_API_KEY`, en desarrollo los emails (incluidos los códigos de acceso) se imprimen en la consola del servidor.

Claves VAPID para las notificaciones push: `npx web-push generate-vapid-keys`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack). El service worker no se registra en desarrollo. |
| `npm run build` / `npm start` | Compila (`next build` + `serwist build`, que genera `public/sw.js`) y arranca en producción. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript (app y service worker). |
| `npm test` | Unitarias (Vitest): algoritmo de sorteo y permisos. |
| `npm run test:integration` | Integración contra la base de datos de `DATABASE_URL`: idempotencia del sorteo y del cron. |
| `npm run test:e2e` | Playwright emulando Pixel 7 (Chrome Android) e iPhone 15 (Safari iOS). Necesita la base de datos levantada. |
| `npm run db:generate` / `npm run db:migrate` | Migraciones Drizzle (`db/migrations`). |
| `npm run icons` | Regenera los iconos PNG de `public/icons`. |

## Arquitectura

- `app/`: rutas (App Router), Server Actions y endpoints (`/api/cron/draws`, `/api/push/subscribe`).
- `lib/`: dominio. `draw/algorithm.ts` (sorteo puro con CSPRNG y detección de casos imposibles), `draw/service.ts` (sorteo transaccional con bloqueo de fila, idempotente), `auth/` (código de 6 dígitos, enlace mágico, sesión), `dal.ts` + `permissions.ts` (autorización siempre en servidor), `i18n/es.ts` (todos los textos).
- `worker/sw.ts`: service worker (Serwist). Caché primero para estáticos, red primero para páginas, **nunca** cachea `/groups/:id/match`, `/groups/:id/results`, invitaciones, login ni API.
- `proxy.ts`: CSP con nonce por petición y renovación deslizante de la cookie de sesión.

## Decisiones tomadas

- **Next.js 16** con Cache Components desactivado: casi todo depende de la sesión y los resultados no deben cachearse en servidor.
- **Enlaces de invitación**: el token se deriva por HMAC del id de la invitación con `SESSION_SECRET`; en base de datos solo se guarda su hash y el administrador puede volver a compartir el mismo enlace. Regenerarlo invalida el anterior.
- **Enlace mágico**: abre una página con un botón «Entrar» (POST) para que los escáneres de email no consuman el token.
- **Crear grupos** requiere email verificado; los invitados pueden unirse con solo su nombre y vincular su email después (si el email ya existía, se fusionan las cuentas).
- **Exclusiones** simétricas. Para cambiar participantes o exclusiones tras el sorteo se reabre el grupo (anula el sorteo y avisa a todos).
- **Rate limiting** en PostgreSQL (tabla `rate_limits`), compartido entre instancias serverless.
- **Sorteos programados**: el cron de `vercel.json` corre una vez al día (límite del plan gratuito de Vercel). Además, un sorteo vencido se ejecuta en cuanto alguien abre el grupo. Con plan Pro se puede subir la frecuencia (p. ej. `*/10 * * * *`).
- `public/offline.html` es estático y no usa el catálogo de textos.
