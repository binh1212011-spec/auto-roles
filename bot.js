import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

let badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json", "utf8"));
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

// ===== Auto assign Unverified =====
client.on('guildMemberAdd', async (member) => {
    try {
        let unverifiedRole = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        if (!unverifiedRole) {
            console.log("Unverified role not found, creating...");
            unverifiedRole = await member.guild.roles.create({ name: "Unverified", permissions: [] });
            console.log(`Created Unverified role ${unverifiedRole.id}`);
        }
        console.log(`Adding Unverified to ${member.user.tag}`);
        setTimeout(async () => {
            await member.roles.add(unverifiedRole).catch(console.error);
            console.log(`Unverified added to ${member.user.tag}`);
        }, 1);
    } catch (err) { console.error(err); }
});

// ===== Function check badges =====
async function checkBadges(member, robloxId) {
    try {
        member = await member.guild.members.fetch(member.id, { force: true });
        const res = await fetch(`https://games.roblox.com/v1/users/${robloxId}/badges?gameId=${GAME_ID}`);
        const data = await res.json();
        if (!data?.data) return;
        const userBadges = data.data.map(b => b.id);

        for (const badgeId of Object.keys(badgeRoles)) {
            let roleId = badgeRoles[badgeId];
            let role = member.guild.roles.cache.get(roleId);

            // Nếu role không tồn tại, tạo mới
            if (!role) {
                role = await member.guild.roles.create({ name: `Badge-${badgeId}`, permissions: [] });
                badgeRoles[badgeId] = role.id;
                fs.writeFileSync("./badgeRoles.json", JSON.stringify(badgeRoles, null, 2));
                console.log(`Created badge role ${role.name} (${role.id})`);
            }

            const botRole = member.guild.members.me.roles.highest;
            if (role.position >= botRole.position) {
                console.log(`Cannot add role ${role.name} to ${member.user.tag} - higher than bot`);
                continue;
            }

            if (userBadges.includes(Number(badgeId))) {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role, "User has badge").catch(console.error);
                    console.log(`Added badge role ${role.name} to ${member.user.tag}`);
                }
            } else {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, "No longer has badge").catch(console.error);
                    console.log(`Removed badge role ${role.name} from ${member.user.tag}`);
                }
            }
        }
    } catch (err) { console.error(err); }
}

// ===== Slash command /verify =====
client.on('interactionCreate', async interaction => {
    try {
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
            let member = await interaction.guild.members.fetch(interaction.user.id, { force: true });

            // Remove Unverified
            let unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
            if (!unverifiedRole) {
                unverifiedRole = await interaction.guild.roles.create({ name: "Unverified", permissions: [] });
            }
            await member.roles.remove(unverifiedRole).catch(console.error);

            // Add Members role
            let verifiedRole = interaction.guild.roles.cache.get(process.env.MEMBERS_ROLE_ID);
            if (!verifiedRole) {
                verifiedRole = await interaction.guild.roles.create({ name: "Members", permissions: [] });
                console.log(`Created Members role ${verifiedRole.id}`);
            }

            const botRole = interaction.guild.members.me.roles.highest;
            if (verifiedRole.position < botRole.position) {
                await member.roles.add(verifiedRole).catch(console.error);
                console.log(`Added Members role to ${member.user.tag}`);
            } else console.log(`Cannot add Members - role higher than bot`);

            // Set nickname Roblox
            try {
                const usernameRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
                const usernameData = await usernameRes.json();
                if (usernameData?.name) await member.setNickname(usernameData.name).catch(console.error);
            } catch (err) { console.error(err); }

            await interaction.reply({ content: 'Verify thành công! Badge sẽ được kiểm tra mỗi 10 giây.', ephemeral: true });

            // Badge check
            setTimeout(() => {
                checkBadges(member, robloxId);
                setInterval(() => checkBadges(member, robloxId), 10000);
            }, 5000);
        }
    } catch (err) { console.error(err); }
});

client.login(process.env.TOKEN);
