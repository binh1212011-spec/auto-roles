const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

// ==== CLIENT ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ==== LOAD ROLE MAPPING ====
const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json"));

// ==== BOT READY ====
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ==== VERIFY BUTTON HANDLER ====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const robloxId = interaction.customId; // Giả sử button customId = Roblox ID
  const roleId = badgeRoles[robloxId];

  if (!roleId) {
    return interaction.reply({ content: "Không tìm thấy role cho Roblox ID này.", ephemeral: true });
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.reply({ content: "Role không tồn tại trên server.", ephemeral: true });

  try {
    await interaction.member.roles.add(role);
    await interaction.reply({ content: `✅ Role đã được gán!`, ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "Có lỗi xảy ra khi gán role.", ephemeral: true });
  }
});

// ==== LOGIN ====
client.login(process.env.TOKEN);
