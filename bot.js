// bot.js
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
require("dotenv").config();

// === CẤU HÌNH ===
// ID kênh để gửi embed (bạn có thể đổi theo server nào muốn test)
const CHANNEL_ID = "1411987904980586576";

// Tạo client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Khi bot sẵn sàng
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    // Lấy kênh bằng ID
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.log("Không tìm thấy kênh để gửi embed");

    // Tạo embed
    const embed = new EmbedBuilder()
      .setColor("#303030")
      .setTitle("Roles played time")
      .setDescription(
        "Tôi mới update vài roles 'chơi chơi' để flex nhưng cái Achievement của bản thân mình :D"
      );

    // Gửi embed 1 lần
    await channel.send({ embeds: [embed] });
    console.log("✅ Embed đã gửi thành công!");
  } catch (err) {
    console.error("❌ Lỗi gửi embed:", err);
  }
});

// Login bot với token từ .env
client.login(process.env.TOKEN);
