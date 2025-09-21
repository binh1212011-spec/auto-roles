// bot.cjs
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const cron = require("node-cron");
const fetch = require("node-fetch");
const badgeRoles = require("./badgeRoles.json");
require("dotenv").config();

// ==== CONFIG ====
const TOKEN = process.env.TOKEN;           // Token bot
const GUILD_ID = process.env.GUILD_ID;     // ID server Discord
const KEEP_ALIVE_PORT = process.env.PORT || 3000;

// ==== KEEP-ALIVE SERVER ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(KEEP_ALIVE_PORT, () => console.log(`Keep-alive running on port ${KEEP_ALIVE_PORT}`));

// ==== DISCORD CLIENT ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Auto-check badges every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    const members = await guild.members.fetch();

    members.forEach(member => {
      if (member.user.bot) return;

      for (const badge in badgeRoles) {
        const roleId = badgeRoles[badge];

        // Giả sử bạn có API verify trả badge list, thay bằng fetch thật
        // Ví dụ: const userBadges = await getBadges(member.id);
        const userBadges = []; // tạm thời để test

        if (userBadges.includes(badge)) {
          if (!member.roles.cache.has(roleId)) member.roles.add(roleId).catch(console.error);
        } else {
          if (member.roles.cache.has(roleId)) member.roles.remove(roleId).catch(console.error);
        }
      }
    });
  });
});

client.login(TOKEN);

