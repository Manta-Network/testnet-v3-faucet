const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const discord = {
    clientId: process.env.DISCORD_APPLICATION_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    token: process.env.DISCORD_BOT_TOKEN,
};

const commands = [];
const commandFiles = fs.readdirSync(path.resolve(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`${path.resolve(__dirname, 'commands')}/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(discord.token);

rest.put(Routes.applicationGuildCommands(discord.clientId, discord.guildId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);
