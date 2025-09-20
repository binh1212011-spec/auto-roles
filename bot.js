const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// root test
app.get("/", (req, res) => res.send("✅ Bot is alive!"));

// verify page
app.get("/verify-page", (req, res) => {
  res.send(`
    <h2>Roblox Verification</h2>
    <form id="verifyForm">
      <label>Discord ID:</label><br>
      <input type="text" id="discordId" required><br><br>
      <label>Roblox Username:</label><br>
      <input type="text" id="robloxUsername" required><br><br>
      <button type="submit">Verify</button>
    </form>
    <script>
      document.getElementById("verifyForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const discordId = document.getElementById("discordId").value;
        const robloxUsername = document.getElementById("robloxUsername").value;
        const res = await fetch("/verify", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({discordId, robloxUsername})
        });
        alert(await res.text());
      });
    </script>
  `);
});

// dummy POST /verify
app.post("/verify", (req, res) => {
  const { discordId, robloxUsername } = req.body;
  if (!discordId || !robloxUsername) return res.status(400).send("❌ Missing fields");
  res.send(`✅ Received Discord ID: ${discordId}, Roblox Username: ${robloxUsername}`);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
