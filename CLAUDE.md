# CLAUDE.md — App de Amigo Invisible (PWA)

Este archivo da contexto a Claude Code sobre el proyecto. Léelo entero antes de escribir código y respétalo en cada tarea.

## Descripción del proyecto

Aplicación **PWA (Progressive Web App)** para organizar sorteos de amigo invisible. Un administrador crea grupos, invita a participantes por WhatsApp, define exclusiones y presupuesto, y realiza el sorteo de forma inmediata o programada. Los resultados se envían por email y se pueden compartir por WhatsApp y otras apps.

## Idioma

- Interfaz de usuario, textos, emails y mensajes de error: **español (España)**.
- Código, nombres de variables, commits y comentarios técnicos: inglés.
- Diseñar los textos para poder internacionalizar más adelante (no dejar cadenas "a fuego" en los componentes).

## Stack tecnológico (decidido, modificable si hay un buen motivo)

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript (modo estricto) | Un solo lenguaje en cliente y servidor |
| Framework | Next.js (App Router) + React | Frontend y backend en un único proyecto, buen soporte PWA |
| Estilos | Tailwind CSS | Rapidez y diseño mobile-first |
| PWA / Service Worker | Serwist (`@serwist/next`) | Mantenido, integra bien con Next.js |
| Base de datos | PostgreSQL (región UE) | Datos muy relacionales: grupos, exclusiones, asignaciones |
| ORM | Drizzle ORM | Tipado y migraciones sencillas |
| Validación | Zod | Validar entradas en servidor y cliente |
| Emails | SMTP con `nodemailer` (ahora Gmail con contraseña de aplicación) o Resend (región UE) | Sin dominio propio, Resend solo envía al dueño de la cuenta; con dominio, volver a Resend |
| Tareas programadas | Cron del hosting que llama a un endpoint protegido (p. ej. Vercel Cron) | Para los sorteos con fecha; sin servidor propio |
| Notificaciones push | Web Push (VAPID) con la librería `web-push` | Estándar PWA; complementa al email, no lo sustituye |
| Tests | Vitest (unitarios) + Playwright (e2e, emulando móvil) | |
| Hosting | Vercel + base de datos gestionada, ambos en región UE | Despliegue simple y cumplimiento RGPD |

Sin una razón clara, no cambiar el stack ni añadir dependencias nuevas.

## Requisitos de PWA

- **Instalable**: `manifest.webmanifest` con nombre, iconos (incluido maskable), `display: standalone`, `theme_color`, `lang: es` y `start_url`.
- **HTTPS obligatorio** en todos los entornos salvo `localhost`.
- **Service worker** con estrategia:
  - App shell y recursos estáticos: caché primero.
  - Datos de grupos y listas de deseos: red primero con respaldo en caché (lectura sin conexión).
  - **Las operaciones críticas requieren conexión**: realizar el sorteo, ver resultados, aceptar invitaciones. Mostrar un aviso claro si no hay red; no encolar estas acciones.
  - **Nunca cachear** las respuestas con resultados del sorteo en el service worker ni en almacenamiento compartido.
- **Actualizaciones**: avisar al usuario cuando haya una versión nueva ("Actualizar") en lugar de recargar sin avisar.
- **Aviso de instalación**: sugerir instalar la app tras una acción con valor (por ejemplo, al aceptar una invitación), nunca al primer segundo. En iOS no existe el aviso automático: mostrar instrucciones breves (Compartir → Añadir a pantalla de inicio).
- **Compatibilidad**: probar en Chrome Android y Safari iOS (la instalación y las notificaciones se comportan distinto).
- **Rendimiento y accesibilidad**: objetivo de Lighthouse ≥ 90 en PWA, rendimiento y accesibilidad.

### Particularidades de iOS que condicionan el diseño
- Las notificaciones push **solo funcionan si la PWA está instalada en la pantalla de inicio** (iOS 16.4 o superior). Por eso **el email es siempre el canal principal**; el push es un extra opcional.
- Safari y la PWA instalada **no comparten cookies ni almacenamiento**. Un enlace mágico abre Safari, no la PWA, y la sesión no llegaría a la app instalada. Por eso el acceso debe poder completarse con un **código de 6 dígitos que se escribe dentro de la propia app** (el enlace queda como alternativa).
- Los enlaces de WhatsApp se abren en el navegador, no en la PWA. El flujo de aceptar una invitación **debe funcionar completo en el navegador**, y la instalación es un paso posterior opcional.

## Requisitos funcionales

### 1. Registro y sesión
- Registro ligero: **nombre y correo electrónico**, sin contraseña.
- Acceso mediante **código de un solo uso de 6 dígitos por email** (caduca en 10 minutos, un solo uso, limitado a pocos intentos). Se ofrece también un enlace mágico equivalente.
- Tras el primer acceso, la **sesión se guarda a nivel de dispositivo**:
  - Cookie de sesión `HttpOnly` + `Secure` + `SameSite=Lax`, emitida por el servidor (preferible a guardar el token en `localStorage`).
  - Sesión larga (p. ej. 90 días) con renovación deslizante y posibilidad de revocarla.
- Los participantes que llegan por la invitación de WhatsApp pueden entrar como **invitados** (cookie anónima con identificador de dispositivo) y **vincular su email después** para recuperar la cuenta en otro dispositivo o si borran los datos del navegador.
- Opción de cerrar sesión en todos los dispositivos.
- La identidad no debe existir **solo** en el dispositivo: la fuente de verdad es siempre el servidor.

### 2. Grupos
- Grupos ilimitados por usuario.
- Cada grupo tiene: nombre, administrador (creador), **presupuesto aproximado** y **fecha de entrega**.

### 3. Participantes e invitaciones
- Cada participante tiene nombre y correo electrónico.
- El administrador comparte una **invitación por WhatsApp** (enlace único por grupo).
- **Solo pueden formar parte del grupo quienes aceptan la invitación.**
- El administrador puede **añadir y quitar** participantes.
- Las invitaciones **caducan a los 30 días o al realizarse el sorteo**, lo que ocurra primero. El administrador puede regenerar el enlace, lo que invalida el anterior.
- Si se modifica la lista de participantes después de un sorteo, el sorteo queda **invalidado** y el administrador debe repetirlo; se avisa antes de confirmar el cambio.

### 4. Exclusiones y restricciones
- Solo el **creador del grupo** puede definirlas (por ejemplo, parejas o familiares que no deben regalarse entre sí).
- El algoritmo de sorteo debe respetarlas.
- Si las restricciones hacen imposible un sorteo válido, informar con un mensaje claro en lugar de fallar o entrar en bucle.

### 5. Sorteo
- El administrador puede **realizarlo en el momento** o **programarlo para una fecha y hora** (se almacena en UTC y se muestra en la zona horaria del usuario).
- Reglas del algoritmo:
  - Nadie se regala a sí mismo.
  - Se respetan todas las exclusiones.
  - Cada persona da un regalo y recibe uno (permutación válida).
  - Aleatoriedad criptográficamente segura (`crypto.getRandomValues` o equivalente), nunca `Math.random()`.
- El sorteo **siempre se ejecuta en el servidor**, nunca en el cliente.
- Las asignaciones se guardan en servidor y el sorteo no puede repetirse sin acción explícita del administrador.
- El sorteo programado debe ser **idempotente**: si el cron se ejecuta dos veces o con retraso, no genera dos sorteos. Usar un bloqueo o una restricción única en base de datos.
- Si al llegar la fecha programada el grupo no es sorteable (menos de 3 participantes, restricciones imposibles), no se sortea y se avisa al administrador por email.

### 6. Resultados
- Sección aparte de **Resultados**, visible para el **creador del grupo**, donde ve quién le ha tocado a cada persona.
- Cada participante ve únicamente a quién tiene que regalar.
- **Modo sorpresa (opcional, se elige al crear el grupo)**: el administrador participa sin ver las asignaciones de los demás. Solo podría consultarlas con una confirmación explícita que avise de que se pierde la sorpresa. Por defecto está desactivado, de modo que el administrador ve los resultados como se pidió originalmente.

### 7. Lista de deseos
- Cada participante puede añadir ideas de regalo y **enlaces a tiendas**.
- Quien le regala puede ver la lista de la persona que le ha tocado, y nadie más.
- Validar y sanear los enlaces (solo `http`/`https`, con `rel="noopener noreferrer"` al abrirlos).
- Disponible en modo lectura sin conexión.

### 8. Notificaciones y compartir
- Envío **automático de resultados por email** al realizarse el sorteo.
- **Notificación push opcional** (con permiso explícito del usuario) para avisos como "ya se ha realizado el sorteo"; el contenido no debe revelar asignaciones.
- **Compartir por WhatsApp** y otras apps con la **Web Share API** (`navigator.share`) y, como alternativa cuando no esté disponible, un enlace `https://wa.me/?text=...`.
- Los emails y las notificaciones no deben incluir las asignaciones de otras personas.

## Requisitos no funcionales

- **Privacidad (RGPD):** guardar solo los datos necesarios (nombre y email). Política de privacidad, posibilidad de borrar la cuenta y los datos de un grupo, y servicios y base de datos en región UE.
- **Seguridad:**
  - Tokens de invitación y de acceso largos, aleatorios y no adivinables; guardar solo su hash.
  - Límite de peticiones (rate limiting) en envío de códigos, intentos de acceso y creación de invitaciones.
  - Comprobar siempre la autorización en servidor: un usuario solo accede a sus grupos y a su propio resultado.
  - Cabeceras de seguridad (CSP, HSTS, etc.).
  - El endpoint del cron debe exigir un secreto.
- **Fiabilidad:** reintentos en el envío de emails y registro de fallos.
- **Usabilidad:** mobile-first; el flujo de unirse por invitación debe ser de pocos pasos y sin obligar a instalar nada.

## Modelo de datos orientativo

- `users`: id, nombre, email (único, nulo para invitados no vinculados), creado
- `sessions`: id, user_id, token_hash, caducidad, revocada, dispositivo
- `login_codes`: id, email, code_hash, caducidad, intentos, usado
- `groups`: id, admin_id, nombre, presupuesto, fecha_entrega, estado (borrador / sorteado), sorteo_programado_at, modo_sorpresa
- `participants`: id, group_id, user_id, nombre, email, estado de invitación (pendiente / aceptada)
- `invitations`: id, group_id, token_hash, caducidad, revocada
- `exclusions`: id, group_id, participant_a, participant_b
- `assignments`: id, group_id, giver_id, receiver_id (única por group_id + giver_id)
- `wishlist_items`: id, participant_id, texto, url
- `push_subscriptions`: id, user_id, endpoint, claves, creada

> Es una propuesta de partida; ajustar si la implementación lo requiere.

## Estructura de proyecto prevista

```
/app            rutas y páginas (App Router) y endpoints de API
/components     componentes de interfaz
/lib            lógica de dominio (sorteo, sesión, emails, push)
/db             esquema Drizzle y migraciones
/public         manifest, iconos
/tests          pruebas unitarias y e2e
```

## Comandos (convención al crear el proyecto)

Mantener estos scripts en `package.json` y actualizarlos aquí cuando existan:

- `npm run dev` — desarrollo local
- `npm run build` / `npm start` — compilar y arrancar en producción
- `npm run lint` y `npm run typecheck`
- `npm test` — pruebas unitarias (Vitest)
- `npm run test:integration` — pruebas de integración contra la base de datos (idempotencia del sorteo)
- `npm run test:e2e` — pruebas end-to-end (Playwright)
- `npm run db:generate` / `npm run db:migrate` — migraciones
- `npm run icons` — regenera los iconos PNG de la PWA
- `docker compose up -d` — PostgreSQL local para desarrollo

## Variables de entorno (mantener un `.env.example` sin valores reales)

- `DATABASE_URL`
- `SESSION_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (envío por SMTP, p. ej. Gmail)
- `RESEND_API_KEY` y `EMAIL_FROM`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`
- `CRON_SECRET`
- `APP_URL` (para construir los enlaces de invitación y de acceso)

## Convenciones de trabajo para Claude

- Antes de implementar una funcionalidad grande, **proponer un plan breve** y esperar confirmación.
- Cambios pequeños y revisables; un tema por commit.
- Escribir **tests** para el algoritmo de sorteo (exclusiones, casos imposibles, nadie se toca a sí mismo, idempotencia) y para los permisos de acceso a resultados.
- No guardar secretos ni claves en el repositorio.
- No añadir dependencias nuevas sin justificarlas.
- Si un requisito es ambiguo, **preguntar** en lugar de asumir.
- Probar siempre los flujos de acceso e invitación en un navegador móvil real o emulado, incluyendo el caso de iOS con la PWA instalada.

## Decisiones abiertas

- Dominio y nombre definitivo de la app.
- Si se mantiene Vercel como hosting o se prefiere otro proveedor en la UE.
- Qué hacer si un participante rechaza o abandona el grupo después del sorteo (por defecto: el administrador lo quita y debe repetir el sorteo, avisando a todos).

## Fuera de alcance (por ahora)

- App nativa en tiendas (App Store / Google Play).
- Pagos o compra de regalos dentro de la app.
- Chat entre participantes.
- Inicio de sesión con redes sociales.
