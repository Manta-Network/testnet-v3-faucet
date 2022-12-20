import { REST, Routes } from 'discord.js';

//const commandPrefix = 'gimme';
const commandPrefix = 'dai';
const tokens = ['ausd'];

const commands = tokens.map((token) => ({
  name: `${commandPrefix}-${token}`,
  description: `request ${token} from the testnet v3 faucet`,
}));

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('[init] refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID), { body: commands });
    console.log('[init] application (/) commands refreshed.');
  } catch (error) {
    console.error(error);
  }
})();
