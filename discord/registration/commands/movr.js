const { SlashCommandBuilder, SlashCommandStringOption } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gimme-movr')
        .addStringOption(
            new SlashCommandStringOption()
                .setName("address")
                .setRequired(true)
                .setDescription("Address to send the tokens to")
        )
        .setDescription('Gives you MOVR'),
    async execute(interaction) {
        await interaction.reply('Gimme!');
    },
};
