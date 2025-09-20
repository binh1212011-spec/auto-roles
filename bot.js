async function checkAllMembers() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();
  console.log(`🔍 Checking ${members.size} members...`);

  for (const [id, member] of members) {
    if (member.user.bot) continue;

    console.log(`👤 Checking ${member.user.tag} (${id})`);

    const robloxId = await getRobloxId(id);
    if (!robloxId) {
      console.log(`⚠️ No RobloxId found for ${member.user.tag}`);
      continue;
    }

    console.log(`➡️ ${member.user.tag} linked to RobloxId ${robloxId}`);

    for (const badgeId of Object.keys(badgeRoles)) {
      const roleId = badgeRoles[badgeId];

      const ownsBadge = await hasBadge(robloxId, badgeId);
      console.log(`   🎖️ Badge ${badgeId}: ${ownsBadge}`);

      if (ownsBadge) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(console.error);
          console.log(
            `✅ Added role ${roleId} to ${member.user.tag} for badge ${badgeId}`
          );
        }
      }
    }
  }
}
