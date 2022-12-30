'use strict';

const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const { putRequest } = require('./crud');
const { SQSClient, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-east-2' });
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { cryptoWaitReady, mnemonicToLegacySeed, hdEthereum } = require('@polkadot/util-crypto');
const { chains } = require('./const');
const cache = {
  lifetime: 3600 * 24,
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}

const notify = async (interaction, symbol, cacheKey) => {
  const { fxHash, fxTime, bxHash, bxTime, txHash, txTime } = cache[cacheKey].value;
  const options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: (!!fxHash)
        ? `<@${interaction.user.id}> your ${symbol.toLowerCase()} token transfer was finalized at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(fxTime).toLowerCase()} (utc) in block: ${fxHash}`
        : (!!bxHash)
          ? `<@${interaction.user.id}> your ${symbol.toLowerCase()} token transfer was processed at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(bxTime).toLowerCase()} (utc) in block: ${bxHash}`
          : (!!txHash)
            ? `<@${interaction.user.id}> your ${symbol.toLowerCase()} token transfer was triggered at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(txTime).toLowerCase()} (utc) in transaction: ${txHash}`
            : `<@${interaction.user.id}> your ${symbol.toLowerCase()} token transfer is in progress...`,
      ...(symbol === 'DOL' && (!!fxHash || !!bxHash)) && {
        embeds: (!!fxHash)
          ? [
              {
                title: 'view on polkadot.js',
                url: `https://polkadot.js.org/apps/?rpc=${chains[symbol].socket}#/explorer/query/${fxHash}`,
                type: 'rich',
                thumbnail: {
                  url: chains[symbol].logo,
                  height: 50,
                  width: 50,
                },
              },
              /*
              {
                title: 'view on subscan',
                url: `https://dolphin.subscan.io/extrinsic/${fxHash}`,
                type: 'rich',
                thumbnail: {
                  url: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/subscan.png',
                  height: 50,
                  width: 50,
                },
              }
              */
            ]
          : [
              {
                title: 'view on polkadot.js',
                url: `https://polkadot.js.org/apps/?rpc=${chains[symbol].socket}#/explorer/query/${bxHash}`,
                type: 'rich',
                thumbnail: {
                  url: chains[symbol].logo,
                  height: 50,
                  width: 50,
                },
              }
            ]
      },
      ...(symbol != 'DOL' && (!!fxHash || !!bxHash)) && {
        embeds: [
          {
            title: 'view on polkadot.js',
            url: `https://polkadot.js.org/apps/?rpc=${chains[symbol].socket}#/explorer/query/${(fxHash || bxHash)}`,
            type: 'rich',
            thumbnail: {
              url: chains[symbol].logo,
              height: 50,
              width: 50,
            },
          }
        ]
      },
    })
  };
  try {
    const original = await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, options);
    const { id } = await original.json();
    const update = await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/${id}`, options);
    const json = await update.json();
    console.log(`discord update: ${JSON.stringify(json)}`);
  } catch (error) {
    console.error(error);
  }
};

const transactionResponseHandler = (event, api, symbol, interaction, address) => {
  const cacheKey = `${symbol}_${address}`;
  const isInProgress = (!!cache[cacheKey] && !!cache[cacheKey].value && !!cache[cacheKey].value.txHash);
  const cached = {
    ...(!!cache[cacheKey]) && {
      ...cache[cacheKey].value,
    },
    ...(!!event.transaction && !isInProgress) && {
      txHash: event.transaction.hash,
      txTime: event.transaction.timestamp,
    },
    ...(!!event.finalized) && {
      fxHash: event.finalized.hash,
      fxTime: event.finalized.timestamp,
    },
    ...(!!event.block) && {
      bxHash: event.block.hash,
      bxTime: event.block.timestamp,
    },
  };
  cacheAppend(cacheKey, cached);
  console.log(`transaction status: ${JSON.stringify(cached)}`);
}

const getFaucet = (schema) => (
  (schema === 'ethereum')
    ? new Keyring({ type: schema }).addFromUri(u8aToHex(hdEthereum(mnemonicToLegacySeed(process.env.FAUCET_MNEMONIC, '', false, 64), ("m/44'/60'/0'/0/" + 0)).secretKey))
    : new Keyring({ type: schema }).addFromMnemonic(process.env.FAUCET_MNEMONIC)
);

const sendToken = async (symbol, address, interaction, collection) => {
  const { amount, id, options, schema, socket, types, typesBundle } = chains[symbol];
  const provider = new WsProvider(socket);
  const api = await ApiPromise.create((!!options) ? options({ provider, types }) : ({ provider, types, typesBundle }));
  await Promise.all([ api.isReady, cryptoWaitReady() ]);
  const faucet = getFaucet(schema);
  const nonce = await api.rpc.system.accountNextIndex(faucet.address);
  try {
    const unsub = (!!id)
      ? await api.tx.mantaPay
        .publicTransfer({ id, value: amount.toString() }, address)
        .signAndSend(faucet, { nonce }, async (response) => {
          const { transaction } = { transaction: response.txHash };
          const { inBlock: block, finalized } = { ...JSON.parse(JSON.stringify(response.status)) };
          const event = {
            ...(!!transaction) && {
              transaction: {
                hash: transaction.toString(),
                timestamp: new Date(),
              }
            },
            ...(!!block) && {
              block: {
                hash: block.toString(),
                timestamp: new Date(),
              }
            },
            ...(!!finalized) && {
              finalized: {
                hash: finalized.toString(),
                timestamp: new Date(),
              }
            },
          };
          await putRequest(collection, address, symbol, event);
          transactionResponseHandler(event, api, symbol, interaction, address);
          if (!!event.transaction || !!event.block || !!event.finalized) {
            await notify(interaction, symbol, `${symbol}_${address}`);
            //await unsub();
          }
        })
      : await api.tx.balances
        .transfer(address, amount)
        .signAndSend(faucet, { nonce }, async (response) => {
          const { transaction } = { transaction: response.txHash };
          const { inBlock: block, finalized } = { ...JSON.parse(JSON.stringify(response.status)) };
          const event = {
            ...(!!transaction) && {
              transaction: {
                hash: transaction.toString(),
                timestamp: new Date(),
              }
            },
            ...(!!block) && {
              block: {
                hash: block.toString(),
                timestamp: new Date(),
              }
            },
            ...(!!finalized) && {
              finalized: {
                hash: finalized.toString(),
                timestamp: new Date(),
              }
            },
          };
          await putRequest(collection, address, symbol, event);
          transactionResponseHandler(event, api, symbol, interaction, address);
          if (!!event.transaction || !!event.block || !!event.finalized) {
            await notify(interaction, symbol, `${symbol}_${address}`);
            //await unsub();
          }
        });
  } catch (error) {
    console.log(`failed sending from ${symbol} faucet: ${faucet.address}, to: ${address} (${interaction.user.username}/${interaction.user.id})`);
    console.error(error);
  }
};

module.exports.open = async (event) => {
  const mongoClient = await MongoClient.connect(process.env.FAUCET_DATABASE_URI);
  const database = await mongoClient.db('testnet_v3_faucet');
  const collection = await database.collection('request');
  try {
    await Promise.all(event.Records.map(async ({ messageAttributes, receiptHandle }) => {
      const interaction = {
        id: messageAttributes.interactionId.stringValue,
        token: messageAttributes.interactionToken.stringValue,
        user: {
          id: messageAttributes.userId.stringValue,
          username: messageAttributes.username.stringValue,
        },
      };
      const [
        address,
        symbol,
      ] = [
        messageAttributes.address.stringValue,
        messageAttributes.token.stringValue,
      ];
      //await putRequest(collection, address, symbol);
      const cacheKey = `${symbol}_${address}`;
      sqsClient.send(new DeleteMessageCommand({ QueueUrl: process.env.AWS_SQS_URL, ReceiptHandle: receiptHandle }));
      if (!cache[cacheKey] || cache[cacheKey].expires < Date.now()) {
        await sendToken(symbol, address, interaction, collection);
      } else {
        await notify(interaction, symbol, cacheKey);
      }
      return interaction;
    }));
  } finally {
    //await mongoClient.close();
  }
};
