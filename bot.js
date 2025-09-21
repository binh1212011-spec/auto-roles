import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const PORT = process.env.PORT || 3000;

// Load badge roles
const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json"));

// Lưu code verify tạm thời
let verifyCodes = {};

// ==== KEEP ALIVE SERVER ====
const app = express();
app.use(express.json());

// Tạo mã verify
app.post("/generate-code", (req, res) => {
  const { discordId } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000); // 6 chữ số
  verifyCodes[discordId] = code;
  res.json({ code });
});

// Check verify
app.post("/check-code", async (req, res) => {
  const { discordId, robloxUsername } = req.body;
  const code = verifyCodes[discordId];
  if (!code) return res.json({ success: false, reason: "No code generated" });

  // Lấy description Roblox
  const robloxProfile = await fetch(`https://users.roblox.com/v1/users/get-by-username?username=${robloxUsername}`);
  const robloxData = await robloxProfile.json();
  if (robloxData.errors) return res.json({ success: false, reason: "Roblox username not found" });

  const descRes = await fetch(`https://users.roblox.com/v1/users/${robloxData.id}/profile`);
  const profileData = await descRes.json();
  if (!profileData.description.includes(code.toString())) return res.json({ success: false });

  delete verifyCodes[discordId];
  res.json({ success: true, robloxId: robloxData.id, robloxUsername });
});

// Start Express server
app.listen(PORT, () => console.log(`Verify API running on port ${PORT}`));

// ==== DISCORD BOT ====
client.on("guildMemberAdd", async (member) => {
  const unverifiedRole = member.guild.roles.cache.find(r => r.name === "Unverified");
  if (unverifiedRole) await member.roles.add(unverifiedRole);
});

// Slash commands xử lý verify
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "verify") {
    const res = await fetch(`http://localhost:${PORT}/generate-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: interaction.user.id })
    });
    const data = await res.json();
    await interaction.reply(`Mã verify của bạn: **${data.code}**. Hãy thêm vào Roblox profile của bạn.`);
  }

  if (interaction.commandName === "checkverify") {
    const robloxUsername = interaction.options.getString("username");
    const res = await fetch(`http://localhost:${PORT}/check-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: interaction.user.id, robloxUsername })
    });
    const result = await res.json();

    if (!result.success) return interaction.reply(`❌ Verify thất bại. ${result.reason || ""}`);

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const verifiedRole = interaction.guild.roles.cache.find(r => r.name === "Verified");
    if (verifiedRole) await member.roles.add(verifiedRole);

    // đổi nickname
    await member.setNickname(result.robloxUsername);

    interaction.reply("✅ Bạn đã được verify!");
  }
});

// Check badge roles mỗi 10 phút
setInterval(async () => {
  client.guilds.cache.forEach(async (guild) => {
    const members = await guild.members.fetch();
    members.forEach(async (member) => {
      for (const badgeId in badgeRoles) {
        const roleName = badgeRoles[badgeId];
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (!role) continue;

        // Giả lập kiểm tra badge Roblox
        const hasBadge = await checkRobloxBadge(member, badgeId);
        if (!hasBadge && member.roles.cache.has(role.id)) await member.roles.remove(role);
      }
    });
  });
}, 10 * 60 * 1000);

// Giả lập check badge Roblox
async function checkRobloxBadge(member, badgeId) {
  // Trong thực tế: call Roblox API để check badges
  return true; // tạm luôn trả true để thử
}

client.login(process.env.TOKEN);
