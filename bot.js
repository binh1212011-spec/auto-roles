// bot.js
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const fetch = require("node-fetch");
const express = require("express");
require("dotenv").config();

// ==== Config ====
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL = 30 * 1000; // 30 giây cho đỡ spam

// Badge mapping (badgeId -> roleId)
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json"));

// ==== Express keep-alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ==== Discord client ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==== Rover API ====
async function getRobloxId(discordId) {
  try {
    const res = await fetch(`https://verify.eryn.io/api/user/${discordId}`);
    if (!res.ok) {
      console.log(`⚠️ Rover: User ${discordId} not linked (status ${res.status})`);
      return null;
    }
    const data = await res.json();
    console.log(`🔗 Rover: Discord ${discordId} -> Roblox ${data.robloxId}`);
    return data.robloxId || null;
  } catch (err) {
    console.error("❌ Rover API error:", err);
    return null;
  }
}

// ==== Roblox badge check ====
async function hasBadge(userId, badgeId) {
  try {
    const res = await fetch(
      `https://apis.roblox.com/badges/v1/users/${userId}/badges/awarded/${badgeId}`
    );
    console.log(`🔍 Badge check: user ${userId}, badge ${badgeId}, status ${res.status}`);
    if (res.status === 200) {
      const data = await res.json();
      return data.awarded === true;
    }
    return false;
  } catch (err) {
    console.error("❌ Roblox API error:", err);
    return false;
  }
}

// ==== Main loop ====
async function checkAllMembers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  console.log(`👥 Checking ${members.size} members...`);

  for (const [id, member] of members) {
    if (member.user.bot) continue;

    const robloxId = await getRobloxId(id);
    if (!robloxId) continue;

    for (const badgeId of Object.keys(badgeRoles)) {
      const roleId = badgeRoles[badgeId];
      const owns = await hasBadge(robloxId, badgeId);

      if (owns) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(console.error);
          console.log(`✅ Added role ${roleId} to ${member.user.tag} for badge ${badgeId}`);
        } else {
          console.log(`ℹ️ ${member.user.tag} already has role ${roleId} for badge ${badgeId}`);
        }
      }
    }
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setInterval(checkAllMembers, CHECK_INTERVAL);
});

client.login(TOKEN);
