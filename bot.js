import express from "express";
import { Client, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import cron from "node-cron";
import badgeRoles from "./badgeRoles.json" assert { type: "json" };
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const GUILD_ID = "YOUR_GUILD_ID"; // server ID
const UNVERIFIED_ROLE = "Unverified";
const MEMBER_ROLE = "Members";

// ==== Keep-alive server ====
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

// ==== Verify command (slash command) ====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    {
      body: [
        {
          name: "verify",
          description: "Verify your Roblox account",
          options: [
            {
              name: "username",
              description: "Your Roblox username",
              type: 3, // STRING
              required: true
            }
          ]
        }
      ]
    }
  );
});

// ==== Interaction handler ====
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "verify") {
    const username = interaction.options.getString("username");
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);

    // đổi nickname
    await member.setNickname(username).catch(console.error);

    // add Members, remove Unverified
    const memberRole = guild.roles.cache.find(r => r.name === MEMBER_ROLE);
    const unverifiedRole = guild.roles.cache.find(r => r.name === UNVERIFIED_ROLE);
    if (memberRole) await member.roles.add(memberRole).catch(console.error);
    if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(console.error);

    await interaction.reply(`✅ Verified as ${username}`);
  }
});

// ==== Badge check cron job ====
cron.schedule("*/10 * * * * *", async () => {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();

  members.forEach(async member => {
    if (!member.user.bot) {
      const username = member.displayName;
      const res = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`);
      const data = await res.json();
      if (!data.Id) return;

      const userId = data.Id;
      const badgeRes = await fetch(`https://inventory.roblox.com/v1/users/${userId}/badges`);
      const badgeData = await badgeRes.json();
      const userBadges = badgeData.data.map(b => b.id);

      for (const badgeId in badgeRoles) {
        const roleName = badgeRoles[badgeId];
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (!role) continue;

        if (userBadges.includes(parseInt(badgeId))) {
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch(console.error);
            console.log(`Added role ${roleName} to ${username}`);
          }
        } else {
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role).catch(console.error);
            console.log(`Removed role ${roleName} from ${username}`);
          }
        }
      }
    }
  });
});

client.login(process.env.TOKEN);
