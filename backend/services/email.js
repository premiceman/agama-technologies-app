const net = require('node:net');
const tls = require('node:tls');

let transportInstance = null;

function getEnvConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error('SMTP_HOST is not configured');
  }

  return { host, port, secure, user, pass };
}

function connectSocket({ host, port, secure }) {
  return secure ? tls.connect({ host, port }) : net.createConnection({ host, port });
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    socket.once('data', data => {
      const message = data.toString();
      const code = parseInt(message.slice(0, 3), 10);
      if (!Number.isFinite(code) || code >= 400) {
        return reject(new Error(`SMTP error ${message.trim()}`));
      }
      resolve({ code, message });
    });
    socket.once('error', reject);
  });
}

async function smtpSendMail({ to, from, subject, text, html }) {
  const config = getEnvConfig();
  const socket = connectSocket(config);

  await new Promise((resolve, reject) => {
    socket.once('ready', resolve);
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  await readResponse(socket); // greeting

  const send = async command => {
    socket.write(`${command}\r\n`);
    return readResponse(socket);
  };

  await send(`EHLO agama-app`);

  if (config.user && config.pass) {
    await send('AUTH LOGIN');
    await send(Buffer.from(config.user).toString('base64'));
    await send(Buffer.from(config.pass).toString('base64'));
  }

  await send(`MAIL FROM:<${from}>`);
  await send(`RCPT TO:<${to}>`);
  await send('DATA');

  const body = html || text || '';
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    html ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '.',
    ''
  ].join('\r\n');

  socket.write(headers);
  await readResponse(socket);
  await send('QUIT');
  socket.end();
}

function getTransport() {
  if (transportInstance) return transportInstance;
  transportInstance = { sendMail: smtpSendMail };
  return transportInstance;
}

async function sendEmail({ to, subject, text, html, from }) {
  if (!to) throw new Error('Email recipient is required');
  if (!subject) throw new Error('Email subject is required');

  const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!sender) {
    throw new Error('SMTP_FROM or SMTP_USER must be provided');
  }

  const transporter = getTransport();
  await transporter.sendMail({ to, from: sender, subject, text, html });
}

function __setTransport(mockTransport) {
  transportInstance = mockTransport;
}

function __resetTransport() {
  transportInstance = null;
}

module.exports = { sendEmail, __setTransport, __resetTransport };
