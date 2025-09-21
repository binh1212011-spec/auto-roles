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

// ===== Keep-alive server =====
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('Keep-alive running'));

// ===== Auto assign Unverified role =====
client.on('guildMemberAdd', async (member) => {
    try {
        const role = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        if (!role) return console.log("Unverified role not found");
        console.log(`Adding Unverified role to ${member.user.tag}`);
        setTimeout(async () => {
            await member.roles.add(role).catch(console.error);
            console.log(`Unverified role added to ${member.user.tag}`);
        }, 1);
    } catch (err) {
        console.error(err);
    }
});

// ===== Function check badges =====
async function checkGameBadges(member, robloxId) {
    try {
        member = await member.guild.members.fetch(member.id); // fetch member để chắc chắn cache
        const res = await fetch(`https://games.roblox.com/v1/users/${robloxId}/badges?gameId=${GAME_ID}`);
        const data = await res.json();
        console.log(`Roblox badge data for ${member.user.tag}:`, data);

        if (!data || !data.data) return;

        const userBadgeIds = data.data.map(b => b.id);

        for (let badgeId of Object.keys(badgeRoles)) {
            const roleId = badgeRoles[badgeId];
            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`Role ID ${roleId} not found`);
                continue;
            }

            if (userBadgeIds.includes(Number(badgeId))) {
                if (!member.roles.cache.has(role.id)) {
                    console.log(`Adding badge role ${role.name} to ${member.user.tag}`);
                    await member.roles.add(role, "User has badge").catch(console.error);
                }
            } else {
                if (member.roles.cache.has(role.id)) {
                    console.log(`Removing badge role ${role.name} from ${member.user.tag}`);
                    await member.roles.remove(role, "User no longer has badge").catch(console.error);
                }
            }
        }
    } catch (err) {
        console.error(`Error checking badges for ${member.user.tag}:`, err);
    }
}

// ===== Slash command /verify =====
client.on('interactionCreate', async interaction => {
    try {
        console.log('Interaction received:', interaction.type, interaction.user.tag);

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

            modal.addComponents(new ActionRowBuilder().addComponents(robloxInput));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'verifyModal') {
            const robloxId = interaction.fields.getTextInputValue('robloxId');
            console.log(`${interaction.user.tag} submitted Roblox ID: ${robloxId}`);

            // Fetch member đầy đủ
            let member = await interaction.guild.members.fetch(interaction.user.id);

            // Remove Unverified
            const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
            if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(console.error);

            // Add Members role
            const verifiedRole = interaction.guild.roles.cache.get(process.env.MEMBERS_ROLE_ID);
            if (verifiedRole) await member.roles.add(verifiedRole).catch(console.error);

            // Set nickname Roblox
            try {
                const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
                const usernameData = await usernameRes.json();
                if (usernameData && usernameData.name) {
                    await member.setNickname(usernameData.name).catch(console.error);
                }
            } catch (err) {
                console.error(err);
            }

            await interaction.reply({ content: 'Verify thành công! Badge sẽ được kiểm tra mỗi 10 giây.', ephemeral: true });

            // Check badges lần đầu sau 5s, sau đó mỗi 10s
            setTimeout(() => {
                checkGameBadges(member, robloxId);
                setInterval(() => checkGameBadges(member, robloxId), 10000);
            }, 5000);
        }
    } catch (err) {
        console.error(err);
    }
});

// ===== Login =====
client.login(process.env.TOKEN);
