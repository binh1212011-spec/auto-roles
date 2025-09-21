import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ===== Load mappings =====
const levelRoles = JSON.parse(fs.readFileSync("./levelRoles.json", "utf8"));
const channelLevels = JSON.parse(fs.readFileSync("./channelLevels.json", "utf8"));
const categoryLevels = JSON.parse(fs.readFileSync("./categoryLevels.json", "utf8"));

// ===== Client =====
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

// ===== Event: messageCreate =====
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    let requiredLevel = channelLevels[message.channel.id];

    // Nếu channel không set level → check category
    if (!requiredLevel && message.channel.parentId) {
        requiredLevel = categoryLevels[message.channel.parentId];
    }

    if (!requiredLevel) return; // Channel & category không cần level gate

    const member = await message.guild.members.fetch(message.author.id);
    const userLevel = getUserLevel(member);

    if (userLevel < requiredLevel) {
        // Xóa message và gửi cảnh báo ephemeral
        await message.delete().catch(() => {});
        const reply = await message.channel.send({
            content: `<@${member.id}>, bạn cần **level ${requiredLevel}** để truy cập kênh này. Hiện tại level của bạn: ${userLevel}`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
    }
});

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

client.login(process.env.TOKEN);
