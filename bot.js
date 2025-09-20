// bot2.js
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
require("dotenv").config();

// ==== Config ====
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHECK_INTERVAL = 10 * 1000; // 10 giây
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json")); // badgeId -> roleId

// ==== Discord client ====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ==== Rover API: Discord ID -> Roblox ID ====
async function getRobloxId(discordId) {
  try {
    const res = await fetch(`https://verify.eryn.io/api/user/${discordId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.robloxId || null;
  } catch (err) {
    console.error("❌ Rover API error:", err);
    return null;
  }
}

// ==== Roblox API: check badge ownership ====
async function hasBadge(userId, badgeId) {
  try {
    const res = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges/awarded-dates?badgeIds=${badgeId}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (err) {
    console.error("❌ Roblox API error:", err);
    return false;
  }
}

// ==== Main loop: check all members ====
async function checkAllMembers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  for (const [id, member] of members) {
    if (member.user.bot) continue;

    const robloxId = await getRobloxId(id);
    if (!robloxId) continue;

    for (const badgeId of Object.keys(badgeRoles)) {
      const roleId = badgeRoles[badgeId];

      if (await hasBadge(robloxId, badgeId)) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(console.error);
          console.log(`✅ Added role ${roleId} to ${member.user.tag} for badge ${badgeId}`);
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
