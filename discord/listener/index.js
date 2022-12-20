const { Faucet } = require('./faucet');
const { SQS } = require('aws-sdk');
const { Client, Events, GatewayIntentBits } = require('discord.js');

const sqs = new SQS({ region: 'us-east-2' });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, (c) => console.log(`discord client signed in as: ${c.user.tag}.`));
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!!command) {
        console.log('observed:', JSON.stringify({command, interaction}));
        /*
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
        }
        */
    else {
        console.error(`observed unrecognised command from discord: ${interaction.commandName}.`);
    }
});

async function processQueuedMessages (faucet) {
    const queue = await sqs.receiveMessage({
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ["All"],
        QueueUrl: process.env.AWS_SQS_URL,
        VisibilityTimeout: 10,
        WaitTimeSeconds: 0
    }).promise();
    if (!!queue.Messages) {
        console.log(`fetched ${queue.Messages.length} messages from the queue.`);
        for (const message of queue.Messages) {
            await faucet.process_transfer(JSON.parse(message.Body));
            await sqs.deleteMessage({
                QueueUrl: process.env.AWS_SQS_URL,
                ReceiptHandle: message.ReceiptHandle,
            }).promise();
        }
        console.log(`processed ${queue.Messages.length} messages from the queue.`);
    } else {
        //console.log(`observed an empty queue.`);
    }
}

(async function () {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const faucet = new Faucet(client, process.env.DOLPHIN_FAUCET_MNEMONIC);
    while (true) {
        await processQueuedMessages(faucet);
    }
})()
