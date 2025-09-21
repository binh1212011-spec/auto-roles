import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ===== Load badgeRoles =====
const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json", "utf8"));

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
        let hasBadge = false;

        for (let badgeId of Object.keys(badgeRoles)) {
            try {
                const res = await fetch(`https://api.roblox.com/users/${robloxId}/badges/awarded?badgeId=${badgeId}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    hasBadge = true;
                    const roleId = badgeRoles[badgeId];
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) interaction.member.roles.add(role).catch(console.error);
                }
            } catch (err) {
                console.error(`Error checking badge ${badgeId} for user ${robloxId}:`, err);
            }
        }

        // Remove Unverified
        const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) interaction.member.roles.remove(unverifiedRole).catch(console.error);

        // Update nickname
        try {
            const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            const usernameData = await usernameRes.json();
            if (usernameData && usernameData.name) {
                interaction.member.setNickname(usernameData.name).catch(console.error);
            }
        } catch (err) {
            console.error(`Error fetching Roblox username for ${robloxId}:`, err);
        }

        await interaction.reply({ content: hasBadge ? 'Verify thành công!' : 'Không tìm thấy badge!', ephemeral: true });
    }
});

// ===== Login bot =====
client.login(process.env.TOKEN);
