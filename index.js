const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');

const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const dutyUsers = new Map();
const minusUsers = new Map();
const totalTime = new Map();

function format(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

client.on('ready', () => {
  console.log(`${client.user.tag} online!`);

  setInterval(async () => {
    for (const [userId, data] of dutyUsers.entries()) {
      const now = Date.now();
      const afk = now - data.lastMessage;

      if (afk >= 5 * 60 * 1000 && !data.afkGiven) {
        data.afkGiven = true;

        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) continue;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const minus = (minusUsers.get(userId) || 0) + 1;
        minusUsers.set(userId, minus);

        const channel = guild.channels.cache.get(config.logChannel);

        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('⛔ AFK DUTY')
          .setDescription(
            `Dobio si minus jer nisi pisao 5 minute.\n\n⏰ Duty: ${format(now - data.startTime)}\n💤 AFK: ${format(afk)}\n❌ Minusa: ${minus}`
          )
          .setFooter({ text: 'Staff System' })
          .setTimestamp();

        if (channel) {
          channel.send({
            embeds: [embed]
          });
        }
      }
    }
  }, 10000);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const member = message.member;

  if (dutyUsers.has(message.author.id)) {
    const data = dutyUsers.get(message.author.id);
    data.lastMessage = Date.now();
    data.afkGiven = false;
  }

  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'staffduznost') {
    if (!member.roles.cache.has(config.staffRole)) {
      return message.reply('Nemaš permisiju.');
    }

    if (dutyUsers.has(member.id)) {
      return message.reply('Već si na dužnosti.');
    }

    dutyUsers.set(member.id, {
      startTime: Date.now(),
      lastMessage: Date.now(),
      guildId: message.guild.id,
      afkGiven: false
    });

    try {
      await member.setNickname(`${member.user.username} (NA DUŽNOSTI)`);
    } catch {}

    const embed = new EmbedBuilder()
      .setColor('#ff4d4d')
      .setTitle('📋 STAFF INFO')
      .setDescription(
        `👤 ${member}\n\n📌 Status: **ON**\n📊 Ukupno: 0s\n❌ Minusa: ${minusUsers.get(member.id) || 0}`
      )
      .setFooter({ text: 'Staff System' })
      .setTimestamp();

    const channel = message.guild.channels.cache.get(config.logChannel);

    if (channel) {
      channel.send({ embeds: [embed] });
    }

    message.reply('Duty uključen.');
  }

  if (command === 'staffoff') {
    if (!dutyUsers.has(member.id)) {
      return message.reply('Nisi na dužnosti.');
    }

    const data = dutyUsers.get(member.id);

    const vrijeme = Date.now() - data.startTime;

    totalTime.set(member.id, (totalTime.get(member.id) || 0) + vrijeme);

    dutyUsers.delete(member.id);

    try {
      await member.setNickname(`${member.user.username} (VAN DUŽNOSTI)`);
    } catch {}

    const embed = new EmbedBuilder()
      .setColor('#ff4d4d')
      .setTitle('📋 STAFF INFO')
      .setDescription(
        `👤 ${member}\n\n📌 Status: **OFF**\n📊 Ukupno: ${format(totalTime.get(member.id) || 0)}\n❌ Minusa: ${minusUsers.get(member.id) || 0}`
      )
      .setFooter({ text: 'Staff System' })
      .setTimestamp();

    const channel = message.guild.channels.cache.get(config.logChannel);

    if (channel) {
      channel.send({ embeds: [embed] });
    }

    message.reply('Duty ugašen.');
  }

  if (command === 'staffleaderboard') {
    const sorted = [...totalTime.entries()].sort((a, b) => b[1] - a[1]);

    let text = '';

    for (let i = 0; i < sorted.slice(0, 10).length; i++) {
      const [id, time] = sorted[i];

      text += `#${i + 1} <@${id}> — ${format(time)}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('🏆 STAFF LEADERBOARD')
      .setDescription(text || 'Nema podataka.')
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  if (command === 'resetminus') {
    if (!member.roles.cache.has(config.resetRole)) {
      return message.reply('Nemaš permisiju.');
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply('Taguj korisnika.');
    }

    minusUsers.set(user.id, 0);

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ MINUS RESET')
      .setDescription(`Resetovani minusi za ${user}`)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(config.token);
