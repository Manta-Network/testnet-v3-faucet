const { Faucet } = require('./faucet');
const { SQS } = require('aws-sdk');
const { Client, Events, GatewayIntentBits } = require('discord.js');

const processQueuedMessages = async (sqs, faucet) => {
    const queue = await sqs.receiveMessage({
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ['All'],
        QueueUrl: process.env.AWS_SQS_URL,
        VisibilityTimeout: 10,
        WaitTimeSeconds: 0
    }).promise();
    if (!!queue.Messages) {
        console.log(`fetched ${queue.Messages.length} messages from the queue.`);
        for (const message of queue.Messages) {
            await faucet.process_transfer(JSON.parse(message.Body));
            try {
                const deleteMessageResponse = await sqs.deleteMessage({ QueueUrl: process.env.AWS_SQS_URL, ReceiptHandle: message.ReceiptHandle }).promise();
                console.log(JSON.stringify({deleteMessageResponse}));
            } catch (error) {
                //console.error(error);
                console.log(JSON.stringify({error}));
            }
        }
        console.log(`processed ${queue.Messages.length} messages from the queue.`);
    } else {
        console.log(`observed an empty queue.`);
        await new Promise((r) => setTimeout(r, 3000));
    }
};

(async () => {
    const sqs = new SQS({ region: 'us-east-2' });
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.once(Events.ClientReady, (event) => console.log(`discord client signed in as: ${event.user.tag}.`));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const faucet = new Faucet(client, process.env.DOLPHIN_FAUCET_MNEMONIC);
    while (true) {
        try {
            await processQueuedMessages(sqs, faucet);
        } catch (error) {
            console.log(JSON.stringify({error}));
            await new Promise((r) => setTimeout(r, 10000));
        }
    }
})();
