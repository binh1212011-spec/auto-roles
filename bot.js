const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

// ==== Config ====
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const ROVER_API_KEY = process.env.ROVER_API_KEY;
const PORT = process.env.PORT || 3000;

// ==== Discord client ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==== Express keep-alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ==== Load badge-role map ====
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json"));

// ==== Verification embed ====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // gửi embed verify 1 lần
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

  // Start auto-check loop every 3 minutes
  setInterval(checkAllVerifiedUsers, 3 * 60 * 1000);
});

// ==== Rover API check ====
async function getRoverData(userId) {
  try {
    const res = await fetch(`https://verify.eryn.io/api/user/${userId}`, {
      headers: { "Authorization": `Bearer ${ROVER_API_KEY}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("❌ Rover API error:", err);
    return null;
  }
}

// ==== Auto-update roles ====
async function checkAllVerifiedUsers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  for (const [id, member] of members) {
    // Giả sử lưu Roblox userId trong nickname hoặc database
    const robloxId = member.nickname;
    if (!robloxId) continue;

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

// ==== Login bot ====
client.login(TOKEN);
