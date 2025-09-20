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
const CHECK_INTERVAL = 10 * 1000; // 10 seconds
const USER_CHECK_COOLDOWN = 30 * 1000; // 30 seconds

// ==== Express keep-alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ==== Discord client ====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ==== Load badge-role map ====
const badgeRoles = JSON.parse(fs.readFileSync("badgeRoles.json"));

// ==== Verification embed ====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);

  const embedData = fs.existsSync("embedMessage.json") ? JSON.parse(fs.readFileSync("embedMessage.json")) : {};

  if (!embedData.id) {
    const embed = new EmbedBuilder()
      .setTitle("Sol's RNG Verification ✅")
      .setDescription(
        "Welcome to the Sol's RNG community! 🎉\n\n" +
        "To unlock your exclusive roles based on your Roblox achievements, you need to verify your Roblox account. " +
        "Simply click the button below, follow the steps via Rover, and let the magic happen!\n\n" +
        "💡 Once verified, your badges will automatically grant you special roles. " +
        "This is your gateway to show off your accomplishments and gain access to unique community perks.\n\n" +
        "Don't wait—verify now and let the adventure begin! 🚀"
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

  // Start auto-check loop every 10 seconds
  setInterval(checkAllVerifiedUsers, CHECK_INTERVAL);
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

// ==== Auto-check all verified users ====
const lastCheck = new Map();

async function checkAllVerifiedUsers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();
  const membersArray = Array.from(members.values());

  for (let i = 0; i < membersArray.length; i += 10) { // batch 10 users
    const batch = membersArray.slice(i, i + 10);
    for (const member of batch) {
      const now = Date.now();
      if (lastCheck.get(member.id) && now - lastCheck.get(member.id) < USER_CHECK_COOLDOWN) continue;
      lastCheck.set(member.id, now);

      const robloxId = member.nickname; // <-- thay bằng cách lưu Roblox ID
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

      await new Promise(r => setTimeout(r, 200)); // small delay to avoid spamming API
    }
  }
}

// ==== Login ====
client.login(TOKEN);
