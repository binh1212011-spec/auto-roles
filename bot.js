import { Client, GatewayIntentBits, Partials, Events, PermissionsBitField } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ===== Load mappings =====
const levelRoles = JSON.parse(fs.readFileSync("./levelRoles.json", "utf8"));
const categoryLevels = JSON.parse(fs.readFileSync("./categoryLevels.json", "utf8"));

// ===== Create client =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ===== Keep-alive server =====
const app = express();
app.get("/", (req, res) => res.send("Level Gate Bot is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("Keep-alive running"));

// ===== Helper: get user level =====
function getUserLevel(member) {
    let level = 0;
    for (const [roleId, lvl] of Object.entries(levelRoles)) {
        if (member.roles.cache.has(roleId) && lvl > level) level = lvl;
    }
    return level;
}

// ===== Function: apply permissions for a channel based on category level =====
async function applyChannelPermissions(channel) {
    if (!channel.guild || !channel.parentId) return;

    const categoryLevel = categoryLevels[channel.parentId];
    if (!categoryLevel) return;

    const guildRoles = channel.guild.roles.cache;

    // Loop all roles in server
    for (const [roleId, lvl] of Object.entries(levelRoles)) {
        const role = guildRoles.get(roleId);
        if (!role) continue;

        const allow = lvl >= categoryLevel;
        await channel.permissionOverwrites.edit(role, {
            ViewChannel: true,
            ReadMessageHistory: allow,
            SendMessages: allow
        }).catch(console.error);
    }

    // Ensure @everyone can see channel but not read/send
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        ViewChannel: true,
        ReadMessageHistory: false,
        SendMessages: false
    }).catch(console.error);
}

// ===== Event: ready =====
client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Apply permissions for all existing channels in level categories
    client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(channel => {
            if (channel.parentId && categoryLevels[channel.parentId]) {
                applyChannelPermissions(channel);
            }
        });
    });
});

// ===== Event: channelCreate =====
client.on(Events.ChannelCreate, async (channel) => {
    if (channel.parentId && categoryLevels[channel.parentId]) {
        applyChannelPermissions(channel);
    }
});

client.login(process.env.TOKEN);
