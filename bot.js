// bot.js
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

// ==== Config ====
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const ROVER_API_KEY = process.env.ROVER_API_KEY;
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL = 10 * 1000; // 10 giây

// ==== Express keep-alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ==== Discord client ====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ==== Load badge-role map ====
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json"));

// ==== Load verified users DB ====
const verifiedFile = "verifiedUsers.json";
let verifiedUsers = {};
if (fs.existsSync(verifiedFile)) {
  verifiedUsers = JSON.parse(fs.readFileSync(verifiedFile));
}

// ==== Verification embed ====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
  const embedData = fs.existsSync("embedMessage.json") ? JSON.parse(fs.readFileSync("embedMessage.json")) : {};

  if (!embedData.id) {
    const embed = new EmbedBuilder()
      .setTitle("Sol's RNG Verification ✅")
      .setDescription(
        "Welcome! To get your Roblox roles automatically, please verify your Roblox account through Rover.\n\n" +
        "Click the button below to start the verification process. Once verified, your roles will be updated instantly based on your badges earned in Roblox.\n\n" +
        "This process only needs to be done once. Sit back, relax, and let the bot handle your roles!"
      )
      .setColor("#2f3136");

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Verify with Rover")
        .setStyle(ButtonStyle.Link)
        .setURL("https://verify.eryn.io/")
    );

    const sentMsg = await channel.send({ embeds: [embed], components: [button] });
    fs.writeFileSync("embedMessage.json", JSON.stringify({ id: sentMsg.id }, null, 2));
    console.log("✅ Verification embed sent!");
  } else {
    console.log("⚠️ Verification embed already sent, skipping.");
  }

  // Start auto-check loop
  setInterval(checkAllVerifiedUsers, CHECK_INTERVAL);
});

// ==== Rover API check ====
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

// ==== Auto-check all verified users ====
async function checkAllVerifiedUsers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  for (const [id, member] of members) {
    const robloxId = verifiedUsers[member.id]; // Lấy Roblox ID từ DB
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

// ==== Login ====
client.login(TOKEN);
