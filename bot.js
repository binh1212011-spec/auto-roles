const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const badgeRoles = require('./badgeRoles.json');

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
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive running on port ${PORT}`));

// ===== Bot ready =====
client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

// ===== Auto assign Unverified =====
client.on('guildMemberAdd', async (member) => {
    const role = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
    if (!role) return;
    setTimeout(() => member.roles.add(role).catch(console.error), 1);
});

// ===== Slash command /verify =====
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'verify') {
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
    }

    // ===== Modal submit =====
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'verifyModal') {
            const robloxId = interaction.fields.getTextInputValue('robloxId');
            let hasBadge = false;

            for (let badgeId of Object.keys(badgeRoles)) {
                const res = await fetch(`https://api.roblox.com/users/${robloxId}/badges/awarded?badgeId=${badgeId}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    hasBadge = true;
                    const roleId = badgeRoles[badgeId];
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) interaction.member.roles.add(role).catch(console.error);
                }
            }

            // Remove Unverified
            const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
            if (unverifiedRole) interaction.member.roles.remove(unverifiedRole).catch(console.error);

            // Update nickname
            const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            const usernameData = await usernameRes.json();
            if (usernameData && usernameData.name) {
                interaction.member.setNickname(usernameData.name).catch(console.error);
            }

            await interaction.reply({ content: hasBadge ? 'Verify thành công!' : 'Không tìm thấy badge!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
