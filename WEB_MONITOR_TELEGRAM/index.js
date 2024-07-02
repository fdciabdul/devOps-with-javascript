const axios = require('axios');
const { Client } = require('ssh2');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

const urls = config.urls;
const servers = config.servers;

const telegramToken = config.telegramToken;
const telegramChatId = config.telegramChatId;
const bot = new TelegramBot(telegramToken, { polling: true });

async function checkWebsites() {
  for (const url of urls) {
    try {
      await axios.get(url);
    } catch (error) {
      const serverIp = new URL(url).hostname;
      const serverName = servers[serverIp].name;
      sendTelegramNotification(`🚨 *Alert*: The website ${url} on ${serverName} is down. Auto-restarting services in 10 seconds.`, url);
      setTimeout(() => autoRestartServices(serverIp, serverName), 10000); // Auto-restart after 5 minutes
    }
  }
}

function sendTelegramNotification(message, url) {
  const serverIp = new URL(url).hostname;
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Restart Nginx', callback_data: `restart_nginx_${url}` },
          { text: 'Restart PostgreSQL', callback_data: `restart_postgresql_${url}` },
          { text: 'Restart PHP7.4-FPM', callback_data: `restart_php7.4-fpm_${url}` }
        ]
      ]
    }
  };

  bot.sendMessage(telegramChatId, message, options);
}

function restartService(serverIp, service, isAuto = false) {
  const conn = new Client();
  const server = servers[serverIp];
  conn.on('ready', () => {
    conn.exec(`systemctl restart ${service}`, (err, stream) => {
      if (err) throw err;
      stream.on('close', (code, signal) => {
        console.log(`Service ${service} restarted on ${serverIp}`);
        conn.end();
        if (!isAuto) {
          bot.sendMessage(telegramChatId, `🔄 Successfully restarted ${service} on ${server.name}`);
        }
      }).on('data', (data) => {
        console.log(`STDOUT: ${data}`);
      }).stderr.on('data', (data) => {
        console.log(`STDERR: ${data}`);
      });
    });
  }).connect({
    host: serverIp,
    port: 22,
    username: server.login,
    password: server.password,
  });
}

function autoRestartServices(serverIp, serverName) {
  ['nginx', 'postgresql', 'php7.4-fpm'].forEach(service => restartService(serverIp, service, true));
  bot.sendMessage(telegramChatId, `🔄 Auto-restarted all services on ${serverName}`);
}

async function checkWebsiteStatus(url) {
  try {
    await axios.get(url);
    return `✅ *The website ${url} is up.*`;
  } catch (error) {
    return `🚨 *The website ${url} is down.*`;
  }
}

bot.onText(/\/check-status/, async (msg) => {
  const chatId = msg.chat.id;
  let statusMessage = '*Website Status Check*\n\n';

  for (const url of urls) {
    const status = await checkWebsiteStatus(url);
    const serverIp = new URL(url).hostname;
    const serverName = servers[serverIp].name;
    statusMessage += `${status} on ${serverName}\n`;
  }

  bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/restart-service/, (msg) => {
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Restart Nginx on SERVER1', callback_data: `restart_nginx_http://XXXXXX` },
          { text: 'Restart PostgreSQL on SERVER1', callback_data: `restart_postgresql_http://XXXXXX` },
          { text: 'Restart PHP7.4-FPM on SERVER1', callback_data: `restart_php7.4-fpm_http://XXXXXX` }
        ],
        [
          { text: 'Restart Nginx on SERVER2', callback_data: `restart_nginx_http://XXXXXX` },
          { text: 'Restart PostgreSQL on SERVER2', callback_data: `restart_postgresql_http://XXXXXX` },
          { text: 'Restart PHP7.4-FPM on SERVER2', callback_data: `restart_php7.4-fpm_http://XXXXXX` }
        ]
      ]
    }
  };

  bot.sendMessage(msg.chat.id, 'Select a service to restart:', options);
});

bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data.split('_');
  const action = data[0];
  const service = data[1];
  const url = data.slice(2).join('_');
  const serverIp = new URL(url).hostname;
  const serverName = servers[serverIp].name;

  if (action === 'restart') {
    restartService(serverIp, service);
    bot.sendMessage(telegramChatId, `🔄 Restarting ${service} on ${serverName}`);
  }
});

setInterval(checkWebsites, 60000); // Check every minute

console.log('Monitoring script is running...');