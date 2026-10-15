# CLAUDE.md — Amigo Invisible (PWA)

Este archivo da contexto a Claude Code sobre el proyecto. Léelo entero antes de escribir código y respétalo en cada tarea.
Describe **la app tal y como está construida**: si hubiera que rehacerla desde cero, seguir este documento debe dar como resultado la misma app (funcionalidad, arquitectura, diseño, despliegue y decisiones).

## Descripción del proyecto

**Amigo Invisible** es una PWA para organizar sorteos de amigo invisible. Un administrador crea grupos, invita a participantes por WhatsApp (enlace) o por email, define exclusiones y presupuesto, y realiza el sorteo en el momento o programado. Cada participante ve solo a quién regala (en la app y por email) y la lista de deseos de esa persona.

- Producción: `https://anonymous-ruffle.vercel.app` (Vercel, región `fra1`).
- Repositorio: `https://github.com/franhmdev/anonymous-ruffle` (rama `main`; cada push despliega).
- Base de datos: Supabase PostgreSQL en `eu-west-1`.

## Idioma

- Interfaz, textos, emails y mensajes de error: **español (España)**.
- Código, nombres de variables, commits y comentarios técnicos: **inglés**.
- **Ningún texto de interfaz en los componentes**: todo sale del catálogo `lib/i18n/es.ts` (objeto `t`), con `format(plantilla, {vars})` para interpolar `{nombre}`. Única excepción: `public/offline.html` (estático, servido por el service worker).

## Stack (versiones instaladas)

| Capa | Elección | Notas |
|---|---|---|
| Lenguaje | TypeScript estricto | `tsconfig` target ES2022; `worker/` tiene su propio tsconfig (lib `webworker`) |
| Framework | **Next.js 16.4** (App Router, Turbopack) + **React 19.3** | `cacheComponents` **desactivado** (ver Decisiones). `middleware` se llama **`proxy.ts`** en Next 16. Leer `node_modules/next/dist/docs/` ante dudas: esta versión difiere de versiones anteriores |
| Estilos | **Tailwind CSS 4** (`@tailwindcss/turbopack`) | Tokens y utilidades propias en `app/globals.css` (ver Diseño) |
| Tipografía | **Nunito** vía `next/font/google` (fuente variable, sin lista de pesos) | |
| PWA | **Serwist 9** en modo CLI: `@serwist/next/config` + `@serwist/cli` | El service worker se compila **después** de `next build` (`serwist build serwist.config.mjs`), compatible con Turbopack |
| Base de datos | PostgreSQL (Supabase UE en prod, Docker en local) | Driver `postgres` (postgres.js) con `prepare: false` |
| ORM | **Drizzle ORM 0.45** + drizzle-kit 0.31 | Migraciones SQL en `db/migrations` |
| Validación | **Zod 4** | `z.email()`, `z.url({protocol})`, `z.iso.date()`… |
| Emails | **SMTP con `nodemailer`** (Gmail con contraseña de aplicación) **o Resend** | SMTP tiene prioridad si está configurado |
| Push | **Web Push (VAPID)** con `web-push` | Opcional; el email es el canal principal |
| Tests | **Vitest 4** (unitarias + integración) y **Playwright** (e2e, Pixel 7 e iPhone 15) | |
| Otros | `server-only` (protege módulos de servidor), `dotenv` (drizzle.config y tests) | |

No añadir dependencias sin justificarlo. Iconos: **SVG inline propios** en `components/icons.tsx` (no hay librería de iconos).

## Estructura

```
app/
  layout.tsx                 html lang=es, Nunito, await connection(), OfflineBanner, ServiceWorkerManager, InstallPromptListener
  page.tsx                   Inicio: landing (anónimo) o "Tus amigos invisibles" (con sesión)
  manifest.ts                manifest.webmanifest
  login/ (page, verify/page, actions.ts)   código de 6 dígitos
  auth/verify/page.tsx       enlace mágico (requiere pulsar "Entrar": POST)
  account/ (page, actions)   nombre, vincular email, push, cerrar sesión (este / todos), borrar cuenta, enlace a privacidad
  join/ (page, actions)      pegar un enlace de invitación → /invite/[token]
  invite/[token]/            ver invitación y unirse (invitado o con cuenta)
  groups/new/                crear grupo
  groups/[id]/page.tsx       detalle del grupo (+ ejecuta un sorteo programado vencido)
  groups/[id]/_sections/     admin-panel, member-list, group-options (bottom sheet)
  groups/[id]/edit/          editar nombre, presupuesto y fecha
  groups/[id]/match/         a quién regalo + su lista de deseos (NUNCA cacheado)
  groups/[id]/results/       todas las asignaciones (solo admin; NUNCA cacheado)
  groups/[id]/wishlist/      mi lista de deseos
  groups/[id]/actions.ts     todas las Server Actions del grupo
  api/cron/draws/route.ts    cron protegido con CRON_SECRET
  api/push/subscribe/route.ts  alta/baja de suscripciones push
  privacy/, not-found.tsx, error.tsx
components/                  page-shell, bottom-sheet, icons, action-form, submit-button, confirm-submit,
                             share-button (ShareButton + ShareAction), group-fields, schedule-input, time-zone-input,
                             local-date-time, wishlist-items, push-toggle, logout-form, online-status, pwa/*
lib/                         env, crypto, i18n, validation, rate-limit, form-state, dal, permissions, invitations,
                             account, push, auth/{session,login,merge}, draw/{algorithm,service}, email/{send,templates}
db/                          schema.ts, index.ts (cliente perezoso), migrations/
worker/sw.ts                 service worker (fuente) → public/sw.js (generado, en .gitignore)
scripts/generate-icons.mjs   genera los PNG de iconos sin dependencias (zlib)
proxy.ts                     CSP con nonce + renovación de la cookie de sesión
tests/unit, tests/integration, tests/e2e
```

## Funcionalidad

### 1. Registro y sesión
- Registro ligero: **nombre y email**, sin contraseña. El formulario de `/login` pide email y nombre (el nombre solo hace falta la primera vez; si un usuario nuevo pide otro código sin nombre, se reutiliza el de su petición anterior de las últimas 24 h).
- Acceso con **código de 6 dígitos** (CSPRNG) por email: caduca en **10 min**, un solo uso (al pedir uno nuevo se invalidan los anteriores), **máx. 5 intentos** por código. Se guarda solo `HMAC(SESSION_SECRET, email:código)`.
- **Enlace mágico** equivalente en el mismo email → `/auth/verify?token=…` muestra un botón «Entrar» (POST) para que los escáneres de correo no consuman el token.
- Sesión: token aleatorio de 256 bits en cookie **`HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`**, nombre `__Host-ai_session` en producción y `ai_session` en desarrollo. Duración **90 días**, **deslizante**: `proxy.ts` reemite la cookie en cada navegación de documento y el servidor amplía `expires_at` como mucho una vez al día. En BD solo el hash. Revocable.
- Cerrar sesión (este dispositivo) y **cerrar sesión en todos los dispositivos**. Al cerrar sesión el cliente borra las cachés privadas del service worker (`ai-private-*`).
- **Invitados**: quien llega por el enlace de WhatsApp se une solo con su nombre; se crea un `user` sin email y una sesión normal. Puede **vincular su email** desde «Mi cuenta» (código con `link_user_id`); si el email ya tenía cuenta, se **fusionan** (participaciones, grupos administrados, sesiones y suscripciones pasan a la cuenta existente; si ambos estaban en el mismo grupo se elimina el duplicado y, si estaba sorteado, se anula el sorteo).
- **Crear grupos requiere email verificado** (el admin necesita recibir avisos).

### 2. Grupos
- Ilimitados. Campos: nombre (≤80), presupuesto aproximado en euros enteros (opcional), fecha de entrega (`date`, opcional), modo sorpresa, zona horaria IANA (tomada del navegador), estado `draft`/`drawn`, sorteo programado (UTC), último error de sorteo programado.
- Al crear: casilla «Yo también participo» (marcada por defecto; añade al admin como participante aceptado) y «Modo sorpresa». Se genera automáticamente el enlace de invitación y se redirige a `/groups/[id]?welcome=1`.
- Editar en `/groups/[id]/edit`. Borrar grupo (con confirmación) desde «Opciones del grupo».

### 3. Participantes e invitaciones
- **Enlace de grupo**: el token se **deriva** como `HMAC(SESSION_SECRET, "invitation-token:" + invitation.id)`; en BD solo se guarda su hash. Así el admin puede volver a ver y compartir el mismo enlace; «Generar un enlace nuevo» revoca el anterior.
- **Invitación personal por email**: «Añadir participante» (nombre + email) crea un participante `pending` y le envía un enlace personal; «Reenviar invitación» genera uno nuevo.
- Las invitaciones **caducan a los 30 días o al hacerse el sorteo** (se revocan todas al sortear) y no valen si el grupo no está en `draft`.
- **Solo cuentan los participantes aceptados.** Al aceptar: si el usuario ya estaba, se marca aceptado; si la invitación es personal (o hay un pendiente con su email), se reclama ese registro; si no, se crea uno nuevo. Se bloquea la fila del grupo (`FOR UPDATE`) para no aceptar durante un sorteo.
- `/join`: pegar un enlace (o solo el token) lleva a `/invite/[token]`. La página de invitación funciona completa en el navegador, sin instalar nada.
- Quitar participante: con confirmación. **Cualquier cambio de participantes con el grupo sorteado anula el sorteo** (se pide `confirm=yes` en servidor y se avisa a todos por email y push).

### 4. Exclusiones
- Solo el admin. **Simétricas** (A↔B), guardadas con `participant_a < participant_b` (CHECK + único).
- En la UI se gestionan **por persona**: bajo cada participante, etiquetas «No se regalan entre sí con: X ×» (pulsar × elimina) y botón «Añadir exclusiones» que abre un bottom sheet con un selector.
- Solo editables en `draft`; para cambiarlas tras el sorteo hay que **reabrir el grupo** (anula el sorteo y avisa).

### 5. Sorteo
- Algoritmo (`lib/draw/algorithm.ts`, puro y testeado):
  - Mínimo **3** participantes aceptados; nadie se regala a sí mismo; respeta exclusiones; permutación válida. Probado con 100 participantes en menos de 2 s (`MAX_PARTICIPANTS = 100` existe como referencia, pero **todavía no se aplica** ningún límite).
  - Aleatoriedad con `crypto.randomInt` (CSPRNG), nunca `Math.random()`.
  - Primero comprueba que existe un emparejamiento perfecto (algoritmo de Kuhn); si no, devuelve `impossible` sin buscar.
  - Intenta **muestreo por rechazo** (hasta 2.000 permutaciones aleatorias, uniforme) y, si no encuentra, una **construcción** que elige receptor al azar manteniendo siempre un emparejamiento perfecto posible → siempre termina.
- Servicio (`lib/draw/service.ts`): el sorteo **siempre en servidor**, dentro de una transacción con `SELECT … FOR UPDATE` sobre el grupo. Si ya está `drawn` → `already_drawn` (idempotente). Inserta asignaciones (únicas por `group+giver` y `group+receiver`, CHECK giver≠receiver), pasa a `drawn`, revoca invitaciones.
- Tras sortear (con `after()`): email a cada participante con **solo su** asignación (presupuesto, fecha y enlace a `/match`) y push genérico sin revelar nada.
- **Repetir sorteo** (anula y vuelve a sortear) y **Reabrir grupo** (anula y vuelve a `draft`), ambos con confirmación; se notifica a todos.
- **Programado**: `datetime-local` convertido a ISO UTC en el navegador; se guarda UTC y se muestra en la zona horaria del usuario (`LocalDateTime`). Se ejecuta:
  1. con el **cron diario** de Vercel (`0 7 * * *`, plan gratuito) → `GET /api/cron/draws` con `Authorization: Bearer CRON_SECRET`;
  2. y además **al abrir el grupo** cuando ya ha pasado la hora (`runScheduledDrawIfDue`), para no esperar al cron.
  Ambos son idempotentes. Si al llegar la hora no es sorteable (<3 aceptados o imposible), **se borra la programación**, se guarda `last_draw_error` (se muestra al admin) y se le envía un email.

### 6. Resultados
- `/groups/[id]/results`: solo el admin ve todas las asignaciones (tabla). Si el admin participa y el grupo está en **modo sorpresa**, primero se muestra un aviso y debe confirmar explícitamente (se guarda `surprise_revealed_at`).
- `/groups/[id]/match`: cada participante ve **solo** a quién regala y la lista de deseos de esa persona.
- Nadie más ve listas de deseos ajenas (ni el admin).
- Enlaces a estas páginas con `prefetch={false}`; respuestas con `Cache-Control: private, no-store`.

### 7. Lista de deseos
- Ideas (≤200 caracteres) con enlace opcional; máx. 30 por participante.
- Enlaces: solo `http`/`https` (validados al guardar y al mostrar), abiertos con `target="_blank" rel="noopener noreferrer nofollow"` y `referrerPolicy="no-referrer"`.
- La propia lista se puede leer sin conexión (caché del service worker).

### 8. Notificaciones y compartir
- Emails: código de acceso, invitación personal, resultado del sorteo, sorteo anulado y fallo de sorteo programado. HTML simple y accesible + versión texto; todo el contenido se escapa.
- Push opcional (botón en «Mi cuenta», pide permiso solo tras pulsarlo; en iOS explica que hace falta instalar la app). Se eliminan suscripciones caducadas (404/410).
- Compartir: Web Share API (`navigator.share`) con alternativa `https://wa.me/?text=…`, y botón Copiar.

## Diseño (UI)

Inspirado en apps móviles de amigo invisible: azul, tarjetas blancas muy redondeadas y paneles inferiores. **Sin** elementos premium ni candados.

- **Tokens** (`app/globals.css`, con variante oscura): `--hero #6c8ef5` (fondo azul), `--brand #4f74ee` (azul de enlaces e iconos), `--brand-soft #e8edfd`, `--primary #6e4bf5` (morado, CTA principal), `--warn`/`--warn-soft` (amarillo), `--danger`/`--danger-soft` (rojo), `--accent` (verde éxito), `--background #f3f5fc`, `--surface #fff`, `--muted #8a94a6`.
- **Utilidades** (`@utility`): `btn`, `btn-primary` (morado con sombra), `btn-blue`, `btn-secondary` (azul suave), `btn-outline`, `btn-warn`, `btn-danger`, `btn-icon` (cuadrado translúcido en la cabecera azul), `btn-link`, `card` (radio 28px, sombra azulada), `label`, `input` (radio 2xl, borde 2px), `hint`, `badge`. Como algunas variantes se componen dinámicamente (`btn-${variant}`), están declaradas con `@source inline(...)`.
- **`PageShell`** (todas las páginas): cabecera azul con logo-regalo o botón atrás, regalo centrado y engranaje (→ «Mi cuenta») o acción propia; título en «pastilla». `tone="full"` (inicio: toda la página azul con un regalo grande decorativo) o `tone="hero"` con contenido `overlap` que se superpone a la banda azul.
- **Inicio**: «Tus amigos invisibles», tarjetas con nombre, nº de participantes aceptados, fecha corta («24 dic 2026») e icono de estado (reloj / check). Panel inferior fijo con «Unirse a un grupo» y «+ Nuevo grupo».
- **Grupo**: tarjeta superpuesta con el estado («Faltan participantes», «Listo para el sorteo», «Sorteo programado» o botón «Ver a quién le regalo»), «Mi lista de deseos (n)» y presupuesto/entrega/organizador. Debajo: «Participantes (n)» con botón «Añadir», filas con icono de usuario, menú «⋯» (bottom sheet con reenviar/quitar) y exclusiones; botón «Añadir participante»; aviso de revisar antes del sorteo; tarjeta «Invitar»; tarjeta «Sorteo». El engranaje del admin abre «Opciones del grupo» (Editar, Compartir, Mi cuenta, Borrar).
- **`BottomSheet`**: `<dialog>` nativo con `showModal()` (foco y Esc), anclado abajo, se cierra al pulsar el fondo y **automáticamente cuando una acción de dentro tiene éxito** (`ActionForm` emite el evento `action-success`); si hay error queda abierto.
- **`ConfirmSubmit`**: confirmación en dos pasos en línea (no `window.confirm`), envía `confirm=yes` (comprobado en servidor) y se repliega cuando el servidor responde.
- **`SubmitButton`**: se desactiva sin conexión en operaciones críticas y muestra el motivo.
- Iconos de la PWA: regalo blanco con lazo amarillo sobre azul (`npm run icons`); `theme_color` y `background_color` `#6c8ef5`.

## PWA

- `app/manifest.ts`: nombre «Amigo Invisible», `lang: es`, `display: standalone`, `start_url: /?source=pwa`, iconos 192/512, **maskable 512** y SVG.
- Service worker (`worker/sw.ts`, Serwist):
  - **NetworkOnly**: `/api/*`, `/groups/*/match`, `/groups/*/results`, `/invite/*`, `/login*`, `/auth/*`, `/account*`, peticiones no GET y Server Actions.
  - **CacheFirst** (`ai-static`): `/_next/static`, `/icons`, estilos, scripts, fuentes e imágenes.
  - **NetworkFirst** (`ai-private-pages`, timeout 5 s): navegaciones y peticiones RSC del resto de páginas (lectura sin conexión).
  - Fallback de documentos: `/offline.html`.
  - Precache: solo estáticos y `offline.html` (`precachePrerendered: false`). **Ojo**: el transform de Serwist convierte `public/*.html` en `/public/<nombre>` (404 → falla la instalación), por eso `offline.html` se excluye del glob y se añade a mano con revisión = hash de su contenido.
  - Push y `notificationclick` (solo abre rutas internas).
- Actualizaciones: `skipWaiting: false`; aparece un aviso «Hay una versión nueva — Actualizar» y solo se recarga **si el usuario lo pulsa** (en la primera instalación `clientsClaim` también cambia el controlador y no debe recargar).
- Aviso de instalación (`InstallSuggestion`) solo tras una acción con valor (`?welcome=1` al crear o unirse), colocado **debajo** de las acciones principales para no desplazarlas al hidratar. En iOS muestra «Compartir → Añadir a pantalla de inicio». Descartable (localStorage).
- Banner fijo «Sin conexión». El service worker **no se registra en desarrollo**.
- iOS: push solo con la app instalada (16.4+); Safari y la app instalada no comparten cookies → por eso el código de 6 dígitos se escribe dentro de la app.

## Seguridad y privacidad

- **CSP con nonce por petición** en `proxy.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests` en prod). Requiere render dinámico: `app/layout.tsx` hace `await connection()`.
- Cabeceras en `next.config.ts`: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `/sw.js` sin caché; `no-store` en `match`/`results`. Páginas con token (`/invite`, `/auth/verify`) con `referrer: no-referrer`.
- Tokens y códigos: solo su HMAC con `SESSION_SECRET`. Comparaciones en tiempo constante.
- **Rate limiting en PostgreSQL** (tabla `rate_limits`, ventana fija, compartida entre instancias): 5 códigos/h por email, 20/h por IP, 30 verificaciones/15 min por IP, 30 invitaciones/h por usuario, 30 uniones/h por IP.
- **Autorización siempre en servidor** mediante la Data Access Layer (`lib/dal.ts`: `requireGroupMember`, `requireGroupAdmin`, que devuelven 404 a quien no tiene acceso) y reglas puras testeadas (`lib/permissions.ts`).
- Redirecciones tras login solo a rutas relativas internas (`safeNextPath`).
- **RLS activado en todas las tablas** (migración `0001_enable_rls.sql`) para que la API REST pública de Supabase no exponga datos; la app conecta como propietario y no le afecta.
- RGPD: solo nombre y email; política de privacidad; borrar cuenta (borra sus grupos, sus participaciones —anulando sorteos afectados— y sus códigos); borrar grupo. Logs con emails enmascarados.
- Fiabilidad de emails: 3 intentos con backoff exponencial y registro de fallos; clave de idempotencia en Resend.

## Modelo de datos (Drizzle, `db/schema.ts`)

IDs `uuid` aleatorios; `created_at` en todas.

- `users`: name, email (único, **null para invitados**).
- `sessions`: user_id, token_hash (único), expires_at, last_used_at, revoked_at, device.
- `login_codes`: email, name, code_hash, link_token_hash (único), link_user_id (vincular invitado), expires_at, attempts, used_at.
- `groups`: admin_id, name, budget (int €), delivery_date (date), status (`draft`|`drawn`), scheduled_draw_at, timezone, surprise_mode, surprise_revealed_at, drawn_at, last_draw_error. Índice parcial sobre `scheduled_draw_at` donde `status='draft'`.
- `participants`: group_id, user_id (null si pendiente sin cuenta), name, email, status (`pending`|`accepted`); único (group_id, user_id).
- `invitations`: group_id, participant_id (null = enlace de grupo; si no, personal), token_hash (único), expires_at, revoked_at.
- `exclusions`: group_id, participant_a, participant_b; único y CHECK `a < b`.
- `assignments`: group_id, giver_id, receiver_id; únicos (group, giver) y (group, receiver); CHECK giver ≠ receiver.
- `wishlist_items`: participant_id, text, url.
- `push_subscriptions`: user_id, endpoint (único), p256dh, auth.
- `rate_limits`: key (PK), count, reset_at.

Borrados en cascada desde `users`, `groups` y `participants`. Migraciones: `0000_init.sql`, `0001_enable_rls.sql`.

## Despliegue

- **Vercel** (plan gratuito): importado desde GitHub, `vercel.json` con `regions: ["fra1"]` y cron diario `0 7 * * *`. Build: `npm run build` (= `next build && serwist build serwist.config.mjs`). Las variables de entorno solo se aplican tras **Redeploy**.
- **Supabase** (`eu-west-1`): en Vercel `DATABASE_URL` = **Transaction pooler** (puerto 6543) con **`?max=1`** (tamaño del pool leído de la URL; `prepare: false` obligatorio con el pooler). La conexión directa `db.<ref>.supabase.co` es solo IPv6. Migraciones desde local con `node --env-file=.env.production.local node_modules/drizzle-kit/bin.cjs migrate`. Contraseñas con caracteres especiales deben ir codificadas en la URL.
- **Email en producción: Gmail SMTP** (`smtp.gmail.com:465`, contraseña de aplicación, ~500 destinatarios/día, `EMAIL_FROM` = la dirección de Gmail). Resend sin dominio verificado solo entrega al dueño de la cuenta; si se compra un dominio, volver a Resend.
- El cliente de BD y las variables de entorno se cargan **de forma perezosa** para que `next build` no necesite secretos.

## Variables de entorno (`.env.example` sin valores reales)

- `DATABASE_URL` (admite `?max=N`)
- `SESSION_SECRET` (≥32 caracteres; firma tokens, códigos y deriva enlaces de invitación — cambiarlo invalida sesiones e invitaciones)
- `SMTP_HOST`, `SMTP_PORT` (465 por defecto), `SMTP_USER`, `SMTP_PASSWORD` — tienen prioridad sobre Resend
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`)
- `CRON_SECRET`
- `APP_URL` (sin barra final; base de los enlaces de invitación y acceso)
- Solo desarrollo/tests: `DEV_OUTBOX_FILE` (el mailer de desarrollo escribe ahí los emails para que los e2e lean los códigos).

Archivos locales ignorados por git: `.env.local` (desarrollo), `.env.production.local` (migrar Supabase), `.env.vercel.local` (valores para pegar en Vercel). Sin transporte de email configurado, en desarrollo los emails se imprimen en consola.

## Comandos

- `npm run dev` — desarrollo (Turbopack)
- `npm run build` / `npm start` — producción (incluye `serwist build`)
- `npm run lint` y `npm run typecheck` (`next typegen` + tsc de la app y del worker)
- `npm test` — unitarias (algoritmo y permisos)
- `npm run test:integration` — contra `DATABASE_URL`: concurrencia e idempotencia del sorteo y del cron, sorteos no vencidos/imposibles/insuficientes
- `npm run test:e2e` — Playwright en Pixel 7 e iPhone 15 contra el dev server (limpia `rate_limits` antes de cada ejecución local)
- `npm run db:generate` / `npm run db:migrate` — migraciones
- `npm run icons` — regenera los PNG
- `docker compose up -d` — PostgreSQL 17 local (`amigo/amigo@localhost:5432/amigo_invisible`)

## Decisiones tomadas (y por qué)

- **Cache Components desactivado**: casi todo depende de la sesión y los resultados nunca deben cachearse en servidor; además la CSP con nonce exige render dinámico.
- **Organizador con email obligatorio; participantes pueden ser invitados**. Se valoró que nadie necesitara registro (identidad solo en el dispositivo + enlace de recuperación) y **se descartó por ahora**.
- **Cron diario + ejecución al visitar** por el límite del plan gratuito de Vercel. Con plan Pro, subir la frecuencia (p. ej. `*/10 * * * *`).
- **Gmail SMTP** en lugar de Resend por no tener dominio propio.
- Si un participante abandona tras el sorteo: el admin lo quita y el sorteo se anula y se avisa a todos (se repite con «Repetir sorteo»).
- `vercel.json`/región y Supabase en la UE por RGPD.

## Trampas conocidas (no repetirlas)

- Tailwind 4 solo genera clases que encuentra escritas completas: declarar las compuestas dinámicamente con `@source inline`.
- `next/font` + fuente variable: no pasar lista de pesos.
- Regla de lint `react-hooks/purity`: no usar `Date.now()` en el cuerpo de componentes; moverlo a funciones de `lib`.
- `useActionState`: el éxito es «respuesta sin `error`», aunque no traiga mensaje.
- En e2e, tras `reload()` esperar a la hidratación antes de pulsar botones de cliente (reintentar con `toPass`), esperar la navegación tras unirse (`waitForURL`) y usar `exact: true` en encabezados que se repiten. Los e2e de WebKit en Windows renderizan la fuente variable más fina y no reportan bien `SameSite`: no es un fallo de la app.
- Git Bash colapsa barras invertidas en heredocs: escribir scripts con regex usando el editor.
- `TaskStop` no mata el proceso `node` de `next start`; liberar el puerto a mano.

## Convenciones de trabajo para Claude

- Antes de implementar una funcionalidad grande, **proponer un plan breve** y esperar confirmación.
- Cambios pequeños y revisables; **un tema por commit** (mensajes en inglés).
- Mantener y ampliar los **tests**: algoritmo (exclusiones, imposibles, nadie consigo mismo), permisos de resultados, idempotencia (integración) y flujos e2e en móvil emulado (Android e iOS).
- No guardar secretos en el repositorio ni pedirlos en el chat; usar archivos `.env*.local` o el panel de Vercel.
- No añadir dependencias sin justificarlas.
- Si un requisito es ambiguo, **preguntar**.
- Antes de dar algo por terminado: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` y `npm run test:e2e`.
- Actualizar este archivo cuando cambie algo de lo descrito.

## Decisiones abiertas

- Dominio propio (permitiría volver a Resend y mejorar la entregabilidad).
- Plan de Vercel (frecuencia del cron).
- Organizador sin registro con enlace de recuperación (propuesto y aparcado).
- Aplicar un máximo de participantes por grupo (`MAX_PARTICIPANTS`).

## Fuera de alcance (por ahora)

- App nativa en tiendas.
- Pagos o compra de regalos dentro de la app.
- Chat entre participantes.
- Inicio de sesión con redes sociales.
- Funciones «premium».
