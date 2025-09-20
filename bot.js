// ==== IMPORT MODULES ====
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
require('dotenv').config();

// ==== EXPRESS SERVER (Render cần) ====
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`🚀 Express server running on port ${PORT}`));

// ==== DISCORD BOT ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==== BADGE ROLES SAFE LOAD ====
let badgeRoles = {};
try {
  badgeRoles = JSON.parse(fs.readFileSync('./badgeRoles.json', 'utf-8'));
  console.log('✅ badgeRoles.json loaded');
} catch (err) {
  console.warn('⚠️ badgeRoles.json not found, bot vẫn chạy.');
}

// ==== BOT EVENTS ====
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ==== BOT LOGIN ====
client.login(process.env.TOKEN)
  .catch(err => console.error('❌ Login failed:', err));
