const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const fetch = require("node-fetch");
require("dotenv").config();

// ==== CONFIG ====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const GUILD_ID = process.env.GUILD_ID;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 180000; // 3 phút
const USERS_FILE = "./users.json";
const SENT_FILE = "./sent.json";

// Badge ID → Discord Role ID
const ROLE_MAP = {
  "4356557421515611": "1418084140955205662",
  "3336758570255487": "1418084145648767108",
  "4072147147623458": "1418084149767442483",
  "1605629548712504": "1418084165257003028",
  "2460941940564506": "1418084170168533103",
  "137829805535621":   "1418096022227517440",
  "485557368787476":   "1418095916912480446",
  "1801598389006571":  "1418095889192321064",
  "2295935762202367":  "1418095884339511411",
  "2994269484017383":  "1418095878052384818",
  "1121298629065726":  "1417815932893397113",
  "3516455555443766":  "1418084122479558812",
  "1224551724339726":  "1418084136031223930",
  "2457971054390553":  "1418099134644097204",
  "3236492292509665":  "1418099051320180767",
  "3618488813178695":  "1418099355826651219",
  "2201290015607347":  "1418099458360610837",
  "1896511924362574":  "1418099064217669733",
  "4370606648952666":  "1418099264982220940",
  "1503563480176545":  "1418099416488738967"
};

// ==== HELPER FUNCTIONS ====
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function updateRoles(member, badges) {
  for (const roleId of Object.values(ROLE_MAP)) {
    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(console.error);
  }
  badges.forEach(badgeId => {
    const roleId = ROLE_MAP[badgeId];
    if (roleId) member.roles.add(roleId).catch(console.error);
  });
}

// ==== SEND VERIFY EMBED ONCE ====
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  let sentData = { sent: false };
  if (fs.existsSync(SENT_FILE)) sentData = JSON.parse(fs.readFileSync(SENT_FILE, "utf8"));

  if (!sentData.sent) {
    try {
      const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle("🔑 Roblox Account Verification")
        .setDescription(
          "Welcome to our Roblox server! 🌟\n\n" +
          "Click the button below to verify your Roblox account via Rover.\n" +
          "After verification, your roles will be automatically updated based on badges."
        )
        .setColor("#5865F2")
        .setThumbnail("https://www.roblox.com/favicon.ico")
        .setFooter({ text: "⚠️ Verify only once to get roles" })
        .setTimestamp();

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Verify with Rover ✅")
          .setStyle(ButtonStyle.Link)
          .setURL("https://verify.eryn.io/")
      );

      await channel.send({ embeds: [embed], components: [button] });
      console.log("✅ Verification embed sent!");

      sentData.sent = true;
      fs.writeFileSync(SENT_FILE, JSON.stringify(sentData, null, 2));
    } catch (err) {
      console.error("❌ Error sending verify embed:", err);
    }
  }

  setInterval(checkAllUsers, CHECK_INTERVAL);
});

// ==== CHECK ALL USERS ====
async function checkAllUsers() {
  const users = loadUsers();
  const guild = await client.guilds.fetch(GUILD_ID);

  for (const user of users) {
    try {
      const member = await guild.members.fetch(user.discordId);

      const badgesRes = await fetch(`https://badges.roblox.com/v1/users/${user.robloxId}/badges`);
      const badgesData = await badgesRes.json();
      const latestBadges = badgesData.data.map(b => b.id.toString());

      if (JSON.stringify(latestBadges) !== JSON.stringify(user.badges)) {
        await updateRoles(member, latestBadges);
        user.badges = latestBadges;
        saveUsers(users);
        console.log(`✅ Updated roles for ${member.user.tag}`);
      }
    } catch (err) {
      console.error(`❌ Error checking user ${user.discordId}:`, err);
    }
  }
}

// ==== LOGIN BOT ====
client.login(process.env.TOKEN);
