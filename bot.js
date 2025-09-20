const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

// ==== Client Discord ====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ==== Config ====
const { TOKEN, GUILD_ID, VERIFY_CHANNEL_ID, LOG_CHANNEL_ID, ROVER_API_KEY, PORT } = process.env;
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json"));
const verifiedFile = "verified.json";

// ==== Load verified users ====
let verifiedUsers = fs.existsSync(verifiedFile) ? JSON.parse(fs.readFileSync(verifiedFile)) : {};

// ==== Express keep-alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ==== Verification embed ====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const sentData = fs.existsSync("sent.json") ? JSON.parse(fs.readFileSync("sent.json")) : { sent: false };

  if (!sentData.sent) {
    try {
      const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle("🔑 Roblox Verification")
        .setDescription(
          "Click below to verify your Roblox account via Rover.\n\n" +
          "✅ Once verified, roles will be automatically updated based on your badges."
        )
        .setColor("#2f3136");

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Verify with Rover")
          .setStyle(ButtonStyle.Link)
          .setURL("https://verify.eryn.io/")
      );

      await channel.send({ embeds: [embed], components: [button] });
      console.log("✅ Verification embed sent!");
      fs.writeFileSync("sent.json", JSON.stringify({ sent: true }, null, 2));
    } catch (err) {
      console.error("❌ Error sending verify embed:", err);
    }
  }

  // Bắt đầu loop auto-check badges
  setInterval(checkAllVerifiedUsers, 3 * 60 * 1000); // 3 phút
});

// ==== Rover API ====
async function getRoverData(robloxId) {
  try {
    const res = await fetch(`https://verify.eryn.io/api/user/${robloxId}`, {
      headers: { "Authorization": `Bearer ${ROVER_API_KEY}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("❌ Rover API error:", err);
    return null;
  }
}

// ==== Auto-check và cấp roles ====
async function checkAllVerifiedUsers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  for (const [discordId, robloxId] of Object.entries(verifiedUsers)) {
    const member = members.get(discordId);
    if (!member) continue;

    const roverData = await getRoverData(robloxId);
    if (!roverData || !roverData.badges) continue;

    for (const badge of roverData.badges) {
      const roleId = badgeRoles[badge.id];
      if (roleId && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(console.error);
        console.log(`✅ Added role ${roleId} to ${member.user.tag} for badge ${badge.id}`);
      }
    }
  }
}

// ==== Command lưu Roblox ID sau verify ====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "verify") {
    const robloxId = interaction.options.getString("roblox_id");
    verifiedUsers[interaction.user.id] = robloxId;
    fs.writeFileSync(verifiedFile, JSON.stringify(verifiedUsers, null, 2));
    await interaction.reply({ content: `✅ Your Roblox ID ${robloxId} has been saved! Roles will update automatically.`, ephemeral: true });
  }
});

// ==== Login ====
client.login(TOKEN);
