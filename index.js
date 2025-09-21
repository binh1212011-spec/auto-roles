const { 
    Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, InteractionType
} = require('discord.js');
require('dotenv').config();
const fetch = require('node-fetch');
const badgeRoles = require('./badgeRoles.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const UNVERIFIED_ROLE_ID = 'ID_ROLE_UNVERIFIED';
const MEMBER_ROLE_ID = 'ID_ROLE_MEMBER';

let verifiedUsers = {};

// ==== Slash Command Setup ====
const commands = [
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        console.log('Reloading commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Commands reloaded');
    } catch (err) { console.error(err); }
})();

// ==== Events ====
client.on('guildMemberAdd', async member => {
    // Thêm role Unverified
    const role = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
    if (role) member.roles.add(role).catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        const modal = new ModalBuilder()
            .setCustomId('verifyModal')
            .setTitle('Verify Roblox Account');

        const usernameInput = new TextInputBuilder()
            .setCustomId('robloxUsername')
            .setLabel("Nhập username Roblox")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
        await interaction.showModal(modal);
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'verifyModal') {
        const username = interaction.fields.getTextInputValue('robloxUsername').trim();
        verifiedUsers[interaction.user.id] = username;

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(interaction.user.id);

        if (member.roles.cache.has(UNVERIFIED_ROLE_ID))
            await member.roles.remove(UNVERIFIED_ROLE_ID).catch(console.error);

        if (!member.roles.cache.has(MEMBER_ROLE_ID))
            await member.roles.add(MEMBER_ROLE_ID).catch(console.error);

        await member.setNickname(username).catch(console.error);

        await interaction.reply({ content: `✅ ${username} đã verify!`, ephemeral: true });
    }
});

// ==== Check badges mỗi 10s ====
setInterval(async () => {
    for (const [discordId, username] of Object.entries(verifiedUsers)) {
        try {
            const res = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`);
            const data = await res.json();
            if (!data.Id) continue;

            const robloxId = data.Id;
            const badgeRes = await fetch(`https://badges.roblox.com/v1/users/${robloxId}/badges`);
            const badgeData = await badgeRes.json();
            if (!badgeData.data) continue;

            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(discordId);

            for (const badge of badgeData.data) {
                const roleId = badgeRoles[badge.name];
                if (roleId && !member.roles.cache.has(roleId)) {
                    await member.roles.add(roleId).catch(console.error);
                }
            }
        } catch (e) { console.error(e); }
    }
}, 10000);

client.login(TOKEN);
