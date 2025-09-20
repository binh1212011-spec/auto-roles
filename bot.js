const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const express = require("express");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

// ====== Config ======
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const PUBLIC_URL = process.env.PUBLIC_URL;
const PORT = process.env.PORT || 3000;

// ====== Load badgeRoles ======
const badgeFile = "./bagdeRoles.json";
if (!fs.existsSync(badgeFile)) fs.writeFileSync(badgeFile, "{}");
const badgeRoles = JSON.parse(fs.readFileSync(badgeFile));

// ====== Verified users ======
const dbFile = "./verified.json";
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "{}");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ====== Express Server ======
const app = express();
app.use(express.json());

// Test route
app.get("/", (req, res) => res.send("✅ Bot is alive!"));

// Verify page
app.get("/verify-page", (req, res) => {
  res.send(`
    <h2>Roblox Verification</h2>
    <form id="verifyForm">
      <label>Discord ID:</label><br>
      <input type="text" id="discordId" required><br><br>
      <label>Roblox Username:</label><br>
      <input type="text" id="robloxUsername" required><br><br>
      <button type="submit">Verify</button>
    </form>
    <script>
      document.getElementById("verifyForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const discordId = document.getElementById("discordId").value;
        const robloxUsername = document.getElementById("robloxUsername").value;
        const res = await fetch("/verify", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({discordId, robloxUsername})
        });
        alert(await res.text());
      });
    </script>
  `);
});

// Verify POST
app.post("/verify", async (req, res) => {
  const { discordId, robloxUsername } = req.body;
  if (!discordId || !robloxUsername) return res.status(400).send("❌ Missing Discord ID or Roblox username");

  console.log("=== START VERIFICATION ===");
  console.log("Discord ID:", discordId, "Roblox Username:", robloxUsername);

  // Save locally
  try {
    const db = JSON.parse(fs.readFileSync(dbFile));
    db[discordId] = robloxUsername;
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Failed saving verified.json", e);
    return res.status(500).send("❌ Failed saving verification");
  }

  // Fetch Roblox user ID by username
  let robloxUserId;
  try {
    const response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${robloxUsername}`);
    robloxUserId = response.data.Id;
    console.log("Roblox User ID:", robloxUserId);
  } catch (e) {
    console.error("Failed fetching Roblox user ID:", e);
    return res.status(400).send("❌ Failed fetching Roblox user ID");
  }

  // Fetch user's badges
  let userBadges = [];
  try {
    const response = await axios.get(`https://badges.roproxy.com/v1/users/${robloxUserId}/badges?limit=100&sortOrder=Asc`);
    userBadges = response.data.data.map(badge => badge.id);
    console.log("User's badges:", userBadges);
  } catch (e) {
    console.error("Failed fetching user's badges:", e);
    return res.status(400).send("❌ Failed fetching user's badges");
  }

  // Fetch guild & member
  let guild, member;
  try {
    guild = await client.guilds.fetch(GUILD_ID);
    member = await guild.members.fetch(discordId);
    console.log("Member fetched:", member.user.tag);
    console.log("Member roles before:", member.roles.cache.map(r => `${r.name}:${r.id}`));
  } catch (e) {
    console.error("Failed fetching member:", e);
    return res.status(400).send("❌ Discord member not found in server");
  }

  // Add roles based on badges
  const rolesAdded = [];
  for (const [badgeId, roleId] of Object.entries(badgeRoles)) {
    if (userBadges.includes(badgeId)) {
      if (!member.roles.cache.has(roleId)) {
        try {
          await member.roles.add(roleId);
          rolesAdded.push(roleId);
          console.log(`✅ Added role ${roleId}`);
        } catch (e) {
          console.error(`❌ Failed to add role ${roleId}:`, e.message);
        }
      }
    }
  }

  console.log("Roles after add:", member.roles.cache.map(r => `${r.name}:${r.id}`));
  console.log("Roles added:", rolesAdded);
  res.send(`✅ Verified ${robloxUsername}. Roles added: ${rolesAdded.length > 0 ? rolesAdded.join(", ") : "None"}`);
  console.log("=== VERIFICATION COMPLETE ===");
});

app.listen(PORT, () => console.log(`🌐 Server running at ${PUBLIC_URL}`));

// ===== Discord bot ready & send embed =====
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID);
    if (!channel) return console.log("❌ Verify channel not found");

    const embed = new EmbedBuilder()
      .setColor("#303030")
      .setTitle("Sol's RNG Verification ✅")
      .setDescription("Click the button below to verify your Roblox account.\nRoles auto-assigned based on badges!");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Verify Roblox Account")
        .setStyle(ButtonStyle.Link)
        .setURL(`${PUBLIC_URL}/verify-page`)
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log("📨 Sent verification embed");
  } catch (err) {
    console.error("Error sending embed:", err);
  }
});

client.login(TOKEN);
