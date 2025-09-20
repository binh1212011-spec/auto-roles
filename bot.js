const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const badgeRoles = JSON.parse(fs.readFileSync("./badgeRoles.json", "utf8"));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "verify") {
    const robloxId = interaction.options.getString("roblox_id"); // Nhập trực tiếp Roblox ID

    const member = interaction.member;
    const roles = badgeRoles[robloxId];

    if (!roles || roles.length === 0) {
      return interaction.reply({ content: "❌ Không tìm thấy role cho Roblox ID này.", ephemeral: true });
    }

    let rolesAdded = 0;
    for (const roleId of roles) {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(console.error);
        rolesAdded++;
      }
    }

    await interaction.reply({ content: `✅ Verified! Roles added: ${rolesAdded}`, ephemeral: true });
  }
});

client.login(TOKEN);
