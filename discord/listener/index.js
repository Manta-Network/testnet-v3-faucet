const { SQS, SecretsManager } = require('aws-sdk');
const sqs = new SQS({ region: 'us-east-2' });
const { Faucet } = require('./faucet');

const secretsClient = new SecretsManager();

const { Client, Collection, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const QUEUE_URL = 'https://sqs.us-east-2.amazonaws.com/684317180556/dolphin-faucet-lambda-sqs.fifo';

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const params = {
    MaxNumberOfMessages: 10,
    MessageAttributeNames: ["All"],
    QueueUrl: QUEUE_URL,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 0
};

async function fetch_secrets() {
    const secrets = await secretsClient.getSecretValue({ SecretId: "dolphin-faucet-processor" }).promise();
    return JSON.parse(secrets.SecretString);
}

async function delete_message(handle) {
    var deleteParams = {
      QueueUrl: QUEUE_URL,
      ReceiptHandle: handle
    };
    await sqs.deleteMessage(deleteParams).promise();
}

async function handle_messages (faucet) {
    const result = await sqs.receiveMessage(params).promise();

    if (result.Messages === undefined) {
        return;
    }

    console.log(`Processing ${result.Messages.length} items`);
    for (const msg of result.Messages) {
        const body = JSON.parse(msg.Body);
        const response = await faucet.process_transfer(body);
        await delete_message(msg.ReceiptHandle);
    }
    console.log("Done");
}


(async function () {
    const secrets = await fetch_secrets();
    //await client.login(secrets.DOLPHIN_BOT_TOKEN);
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const faucet = new Faucet(client, secrets.ACCOUNT_MNEMONIC);
    while (true) {
        console.log("Running handler");
        await handle_messages(faucet);
        await sleep(5000);
    }
})()
