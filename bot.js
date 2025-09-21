// bot.js
import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ===== Load badgeRoles =====
const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json", "utf8"));

// ===== Game ID của bạn =====
const GAME_ID = process.env.GAME_ID; // Nhập Game ID thật của bạn trong .env

// ===== Bot setup =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

// ===== Keep-alive server =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive running on port ${PORT}`));

// ===== Auto assign Unverified role =====
client.on('guildMemberAdd', async (member) => {
    const role = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
    if (!role) return;
    setTimeout(() => member.roles.add(role).catch(console.error), 1);
});

// ===== Function check badges cho game của bạn =====
async function checkGameBadges(member, robloxId) {
    try {
        const res = await fetch(`https://games.roblox.com/v1/users/${robloxId}/badges?gameId=${GAME_ID}`);
        const data = await res.json();

        if (!data || !data.data) return;

        const userBadgeIds = data.data.map(b => b.id);

        for (let badgeId of Object.keys(badgeRoles)) {
            const roleId = badgeRoles[badgeId];
            const role = member.guild.roles.cache.get(roleId);
            if (!role) continue;

            if (userBadgeIds.includes(Number(badgeId))) {
                if (!member.roles.cache.has(role.id)) member.roles.add(role).catch(console.error);
            } else {
                if (member.roles.cache.has(role.id)) member.roles.remove(role).catch(console.error);
            }
        }
    } catch (err) {
        console.error(`Error checking badges for user ${robloxId}:`, err);
    }
}

// ===== Slash command /verify =====
client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        const modal = new ModalBuilder()
            .setCustomId('verifyModal')
            .setTitle('Verify Roblox');

        const robloxInput = new TextInputBuilder()
            .setCustomId('robloxId')
            .setLabel("Nhập Roblox ID")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("12345678")
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(robloxInput);
        modal.addComponents(row);
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'verifyModal') {
        const robloxId = interaction.fields.getTextInputValue('robloxId');

        // ===== Remove Unverified =====
        const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) interaction.member.roles.remove(unverifiedRole).catch(console.error);

        // ===== Add Members / Verified role =====
        const verifiedRole = interaction.guild.roles.cache.get(process.env.MEMBERS_ROLE_ID);
        if (verifiedRole) interaction.member.roles.add(verifiedRole).catch(console.error);

        // ===== Update nickname Roblox =====
        try {
            const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            const usernameData = await usernameRes.json();
            if (usernameData && usernameData.name) interaction.member.setNickname(usernameData.name).catch(console.error);
        } catch (err) {
            console.error(`Error fetching Roblox username for ${robloxId}:`, err);
        }

        await interaction.reply({ content: 'Verify thành công! Badge sẽ được kiểm tra mỗi 10 giây.', ephemeral: true });

        // ===== Auto check badges game mỗi 10s, lần đầu sau 5s =====
        setTimeout(() => {
            checkGameBadges(interaction.member, robloxId); // check lần đầu
            setInterval(() => checkGameBadges(interaction.member, robloxId), 10000);
        }, 5000);
    }
});

// ===== Login bot =====
client.login(process.env.TOKEN);
