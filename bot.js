const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Load badgeRoles.json
let badgeRoles;
try {
  badgeRoles = JSON.parse(fs.readFileSync('./badgeRoles.json'));
} catch (err) {
  console.error('❌ Không đọc được badgeRoles.json:', err);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==== EXPRESS KEEP-ALIVE ====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`🚀 Express server running on port ${PORT}`));

// ==== READY EVENT ====
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ==== GUILD MEMBER ADD EVENT ====
client.on('guildMemberAdd', async member => {
  // Test embed khi có người join
  const embed = new EmbedBuilder()
    .setTitle('Chào mừng!')
    .setDescription(`Chào <@${member.id}>! Kiểm tra role Roblox của bạn...`)
    .setColor('#00FF00')
    .setTimestamp();

  const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.isTextBased());
  if (channel) channel.send({ embeds: [embed] });

  // Gán role dựa trên Roblox ID
  // **Bạn cần có cách lấy Roblox ID từ user** 
  // Ví dụ giả lập:
  const robloxID = '4356557421515611'; // Thay bằng logic thực tế
  const roleID = badgeRoles[robloxID];

  if (roleID) {
    try {
      const role = member.guild.roles.cache.get(roleID);
      if (role) await member.roles.add(role);
      console.log(`✅ Gán role ${role.name} cho ${member.user.tag}`);
    } catch (err) {
      console.error('❌ Lỗi khi gán role:', err);
    }
  }
});

// ==== LOGIN ====
client.login(process.env.TOKEN)
  .catch(err => console.error('❌ Login failed:', err));
