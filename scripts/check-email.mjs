// Checks the SMTP settings without the app (and without printing secrets).
//
// 1. Create `.env.smtp.local` (ignored by git) with SMTP_HOST, SMTP_PORT, SMTP_USER,
//    SMTP_PASSWORD and EMAIL_FROM, the same values as in Vercel.
// 2. node --env-file=.env.smtp.local scripts/check-email.mjs [destination@example.com]
//
// Without a destination it only logs in; with one it also sends a test email.
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT = "465", SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;
const missing = Object.entries({ SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM })
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(", ")}`);
  process.exit(1);
}

const password = SMTP_PASSWORD.replace(/\s+/g, "");
console.log(`Servidor: ${SMTP_HOST}:${SMTP_PORT} · usuario: ${SMTP_USER} · contraseña: ${password.length} caracteres`);
if (!EMAIL_FROM.includes(SMTP_USER.trim())) {
  console.warn(
    "Aviso: EMAIL_FROM no contiene la dirección de SMTP_USER; Gmail puede reescribir o rechazar el remitente.",
  );
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST.trim(),
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER.trim(), pass: password },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

try {
  await transport.verify();
  console.log("✓ Conexión e inicio de sesión correctos.");
  const to = process.argv[2];
  if (to) {
    await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject: "Prueba de Amigo Invisible",
      text: "Si lees esto, el envío funciona.",
    });
    console.log(`✓ Email de prueba enviado a ${to}.`);
  }
} catch (error) {
  console.error(`✗ Error: ${[error.code, error.responseCode, error.message].filter(Boolean).join(" ")}`);
  if (error.code === "EAUTH") {
    console.error(
      "  Usuario o contraseña de aplicación incorrectos (¿verificación en dos pasos activada? ¿contraseña de aplicación y no la de Gmail?).",
    );
  }
  process.exit(1);
}
