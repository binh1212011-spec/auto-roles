const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
require("dotenv").config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL;

// Load badgeRoles
const badgeFile = "./bagdeRoles.json";
if (!fs.existsSync(badgeFile)) fs.writeFileSync(badgeFile, "{}");
const badgeRoles = JSON.parse(fs.readFileSync(badgeFile));

// Verified users
const dbFile = "./verified.json";
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "{}");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const app = express();
app.use(express.json());

// root test
app.get("/", (req, res) => res.send("✅ Bot is alive!"));

// verify page
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

// verify POST
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

  // Fetch Roblox user
  let rUser;
  try {
    const userRes = await fetch(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(robloxUsername)}`);
    const userData = await userRes.json();
    if (!userData || !userData.Id) throw new Error("User not found");
    rUser = userData;
    console.log("Roblox user fetched:", rUser);
  } catch (e) {
    console.error("Error fetching Roblox user:", e.message);
    return res.status(400).send("❌ Error fetching Roblox user");
  }

  // Fetch Roblox badges
  let badgeData;
  try {
    const badgeRes = await fetch(`https://badges.roblox.com/v1/users/${rUser.Id}/badges`);
    const badgeJson = await badgeRes.json();
    badgeData = { data: badgeJson.data || [] };
    console.log("User badges fetched:", badgeData.data.map(b=>b.id));
  } catch (e) {
    console.error("Error fetching Roblox badges:", e.message);
    return res.status(400).send("❌ Error fetching Roblox badges");
  }

  const userBadgeIds = badgeData.data.map(b=>b.id.toString());

  // Fetch Discord member
  let member;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    member = await guild.members.fetch(discordId);
    console.log("Member fetched:", member.user.tag);
  } catch(e){
    console.error("Failed fetching Discord member:", e);
    return res.status(400).send("❌ Discord member not found in server");
  }

  // Add roles
  const rolesAdded = [];
  for(const [badgeId, roleId] of Object.entries(badgeRoles)){
    if(userBadgeIds.includes(badgeId) && member.guild.roles.cache.has(roleId) && !member.roles.cache.has(roleId)){
      try {
        await member.roles.add(roleId);
        rolesAdded.push(roleId);
        console.log(`✅ Added role ${roleId}`);
      } catch(e){
        console.error(`❌ Failed to add role ${roleId}:`, e.message);
      }
    }
  }

  console.log("Roles added:", rolesAdded);
  res.send(`✅ Verified ${robloxUsername}. Roles added: ${rolesAdded.length > 0 ? rolesAdded.join(", ") : "None"}`);
  console.log("=== VERIFICATION COMPLETE ===");
});

app.listen(PORT, ()=>console.log(`🌐 Server running at ${PUBLIC_URL}`));

client.once("ready", async ()=>{
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try{
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID);
    if(!channel) return console.log("❌ Verify channel not found");

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

    await channel.send({embeds:[embed], components:[row]});
    console.log("📨 Sent verification embed");
  }catch(err){
    console.error("Error sending embed:", err);
  }
});

client.login(TOKEN);
