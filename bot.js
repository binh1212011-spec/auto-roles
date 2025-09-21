// bot-debug.js
import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json", "utf8"));
const GAME_ID = process.env.GAME_ID;

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

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive running on port ${PORT}`));

client.on('guildMemberAdd', async (member) => {
    const role = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
    if (!role) return console.log("Unverified role not found");
    console.log(`Adding Unverified role to ${member.user.tag}`);
    setTimeout(() => {
        member.roles.add(role)
            .then(() => console.log(`Unverified role added to ${member.user.tag}`))
            .catch(console.error);
    }, 1);
});

async function checkGameBadges(member, robloxId) {
    try {
        const res = await fetch(`https://games.roblox.com/v1/users/${robloxId}/badges?gameId=${GAME_ID}`);
        const data = await res.json();
        console.log(`Badge API for ${member.user.tag}:`, data);

        if (!data || !data.data) return;

        const userBadgeIds = data.data.map(b => b.id);

        for (let badgeId of Object.keys(badgeRoles)) {
            const roleId = badgeRoles[badgeId];
            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`Role ID ${roleId} not found in guild`);
                continue;
            }

            if (userBadgeIds.includes(Number(badgeId))) {
                if (!member.roles.cache.has(role.id)) {
                    console.log(`Adding badge role ${role.name} to ${member.user.tag}`);
                    member.roles.add(role).catch(console.error);
                }
            } else {
                if (member.roles.cache.has(role.id)) {
                    console.log(`Removing badge role ${role.name} from ${member.user.tag}`);
                    member.roles.remove(role).catch(console.error);
                }
            }
        }
    } catch (err) {
        console.error(`Error checking badges for user ${robloxId}:`, err);
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        console.log(`Verify command triggered by ${interaction.user.tag}`);
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
        console.log(`${interaction.user.tag} submitted Roblox ID: ${robloxId}`);

        // Remove Unverified
        const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) {
            interaction.member.roles.remove(unverifiedRole)
                .then(() => console.log(`Removed Unverified from ${interaction.user.tag}`))
                .catch(console.error);
        }

        // Add Members role
        const verifiedRole = interaction.guild.roles.cache.get(process.env.MEMBERS_ROLE_ID);
        if (verifiedRole) {
            interaction.member.roles.add(verifiedRole)
                .then(() => console.log(`Added Members role to ${interaction.user.tag}`))
                .catch(console.error);
        }

        // Set nickname
        try {
            const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            const usernameData = await usernameRes.json();
            console.log(`Fetched Roblox username:`, usernameData);
            if (usernameData && usernameData.name) {
                interaction.member.setNickname(usernameData.name)
                    .then(() => console.log(`Nickname set to ${usernameData.name} for ${interaction.user.tag}`))
                    .catch(console.error);
            }
        } catch (err) {
            console.error(`Error fetching Roblox username for ${robloxId}:`, err);
        }

        await interaction.reply({ content: 'Verify thành công! Badge sẽ được kiểm tra mỗi 10 giây.', ephemeral: true });

        // Check badges lần đầu sau 5s, sau đó 10s
        setTimeout(() => {
            checkGameBadges(interaction.member, robloxId);
            setInterval(() => checkGameBadges(interaction.member, robloxId), 10000);
        }, 5000);
    }
});

client.login(process.env.TOKEN);
