import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import express from "express";
import badgeRoles from "./badgeRoles.json" assert { type: "json" };
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VERIFY_API = process.env.VERIFY_API;
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ================= Keep-Alive Server =================
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// ================= Core Logic =================
async function updateRolesAndNicknames() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  for (const member of members.values()) {
    if (member.user.bot) continue;

    let data;
    try {
      const res = await fetch(`${VERIFY_API}?discordId=${member.id}`);
      data = await res.json();
    } catch (err) {
      console.error(`Error fetching verify for ${member.id}:`, err);
      continue;
    }

    // ---------- Unverified Role ----------
    if (!data || !data.robloxUsername) {
      if (!member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
        member.roles.add(UNVERIFIED_ROLE_ID).catch(console.error);
      }
      continue; // chưa verify -> không làm gì thêm
    } else {
      if (member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
        member.roles.remove(UNVERIFIED_ROLE_ID).catch(console.error);
      }
    }

    const robloxUsername = data.robloxUsername;
    const userBadges = data.badges || [];

    // ---------- Badge Roles ----------
    for (const badge in badgeRoles) {
      const roleId = badgeRoles[badge];
      if (userBadges.includes(badge)) {
        if (!member.roles.cache.has(roleId)) member.roles.add(roleId).catch(console.error);
      } else {
        if (member.roles.cache.has(roleId)) member.roles.remove(roleId).catch(console.error);
      }
    }

    // ---------- Set Nickname ----------
    if (robloxUsername && member.nickname !== robloxUsername) {
      member.setNickname(robloxUsername).catch(console.error);
    }
  }
}

// ================= Schedule Auto Update =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Lần đầu update ngay khi bot bật
  updateRolesAndNicknames();

  // Sau đó mỗi 5 phút update một lần
  setInterval(updateRolesAndNicknames, 5 * 60 * 1000);
});

client.login(TOKEN);

