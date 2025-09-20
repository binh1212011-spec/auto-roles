// ==== IMPORT MODULES ====
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

// ==== CONFIG ====
const TOKEN = process.env.TOKEN; // Token bot
const BADGE_FILE = "./badgeRoles.json"; // file mapping Roblox ID -> Discord Role
const VERIFY_CHANNEL_ID = "YOUR_CHANNEL_ID"; // kênh bot gửi embed verify
let badgeRoles = {};

// ==== LOAD MAPPING ====
try {
  badgeRoles = JSON.parse(fs.readFileSync(BADGE_FILE, "utf8"));
  console.log("✅ Loaded badgeRoles.json");
} catch (err) {
  console.error("❌ Cannot load badgeRoles.json:", err);
}

// ==== CREATE CLIENT ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==== EVENT: READY ====
client.on("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ==== FUNCTION: VERIFY AND ASSIGN ROLE ====
async function verifyUser(member, robloxId) {
  const roleId = badgeRoles[robloxId];
  if (!roleId) return; // không có mapping

  try {
    const role = await member.guild.roles.fetch(roleId);
    if (!role) return console.log("Role not found for ID:", roleId);

    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`✅ Assigned role ${role.name} to ${member.user.tag}`);

      // Send embed in verify channel
      const channel = await member.guild.channels.fetch(VERIFY_CHANNEL_ID);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor("#303030")
          .setTitle("Role Verified")
          .setDescription(`${member} đã được gán role **${role.name}**`)
          .setTimestamp();
        channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error("❌ Error assigning role:", err);
  }
}

// ==== COMMAND SIMULATION (TEST) ====
// Bạn có thể đổi thành command slash hoặc API nhận ID
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Gõ !verify <RobloxID> để test
  if (message.content.startsWith("!verify")) {
    const args = message.content.split(" ");
    const robloxId = args[1];
    if (!robloxId) return message.reply("Bạn cần gửi Roblox ID.");
    await verifyUser(message.member, robloxId);
  }
});

// ==== LOGIN ====
client.login(TOKEN);
