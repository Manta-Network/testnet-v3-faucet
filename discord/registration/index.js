const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const discord = {
    clientId: process.env.DISCORD_APPLICATION_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    token: process.env.DISCORD_BOT_TOKEN,
};
const commands = ['dol', 'kar', 'ksm', 'movr'].map((token) => (
    new SlashCommandBuilder()
        .setName(`gimme-${token}`)
        .setDescription(`request ${token} tokens`)
        .addStringOption((option) => (
            option
                .setName('address')
                .setRequired(true)
                .setDescription(`address to receive ${token} token`)
        ))
));
const rest = new REST({ version: '10' }).setToken(discord.token);
rest.put(Routes.applicationGuildCommands(discord.clientId, discord.guildId), { body: [] })
    .then(() => console.log('deleted old guild commands.'))
    .catch(console.error);
rest.put(Routes.applicationCommands(discord.clientId), { body: [] })
    .then(() => console.log('deleted old application commands.'))
    .catch(console.error);
rest.put(Routes.applicationGuildCommands(discord.clientId, discord.guildId), { body: commands })
    .then(() => console.log(`created guild commands: ${commands.map((c) => c.name).join(', ')}`)
    .catch(console.error);
