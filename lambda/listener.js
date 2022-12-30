'use strict';

const { MongoClient } = require('mongodb');
const { chains } = require('./const');
const { getRequest, putRequest } = require('./crud');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-east-2' });
const nacl = require('tweetnacl');
const { decodeAddress } = require('@polkadot/keyring');
const knownCommands = Object.keys(chains).map((symbol) => symbol).reduce((a, symbol) => ({...a, [`gimme-${symbol.toLowerCase()}`]: symbol}), {});
const defaultResponse = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};


const isAuthentic = (event) => nacl.sign.detached.verify(
  Buffer.from(event.headers['x-signature-timestamp'] + event.body),
  Buffer.from(event.headers['x-signature-ed25519'], 'hex'),
  Buffer.from(process.env.DISCORD_APPLICATION_PUBLIC_KEY, 'hex')
);

const responseBuilder = (statusCode, body) => {
  return {
    ...defaultResponse,
    statusCode,
    body: JSON.stringify(body, null, 2 ),
  };
};

const discordResponseBuilder = (content, flags, embeds) => responseBuilder(
  200,
  {
    type: 4,
    data: {
      allowed_mentions: {
        parse: [
          'users'
        ],
        users: []
      },
      content,
      ...(!!embeds && !!embeds.length) && {
        embeds: embeds.map(({socket, hash, logo}) => ({
          title: 'view on polkadot.js',
          url: `https://polkadot.js.org/apps/?rpc=${socket}#/explorer/query/${hash}`,
          type: 'rich',
          thumbnail: {
            url: logo,
            height: 50,
            width: 50,
          },
        }))
      },
      flags,
    },
  }
);

module.exports.interactions = async (event) => {
  let response;
  try {
    if (isAuthentic(event)) {
      const { channel_id, data, member, type, id: interactionId, token: interactionToken } = JSON.parse(event.body);
      switch (type) {
        case 1:
          response = responseBuilder(200, { type: 1 });
          break;
        case 2:
          const command = data.name;
          const symbol = knownCommands[command];
          if (symbol === undefined) {
            response = responseBuilder(404, { message: 'unrecognised command', command });
          } else if (channel_id !== process.env.DISCORD_CHANNEL_ID) {
            response = discordResponseBuilder(`<@${member.user.id}> please send your faucet requests to <#${process.env.DISCORD_CHANNEL_ID}> channel`, (1<<6));
          } else {
            const interaction = {
              id: interactionId,
              token: interactionToken,
              user: {
                id: member.user.id,
                username: member.user.username,
              },
            };
            const userId = member.user.id;
            const address = data.options[0].value;
            try {
              decodeAddress(address);
            } catch (error) {
              console.error(error);
              response = discordResponseBuilder(`<@${userId}> the given address is not a valid ${knownCommands[command].toLowerCase()} account`, (1<<6));
              break;
            }
            const mongoClient = await MongoClient.connect(process.env.FAUCET_DATABASE_URI);
            const database = await mongoClient.db('testnet_v3_faucet');
            const collection = await database.collection('request');
            await putRequest(collection, address, symbol, { interaction });
            const request = await getRequest(collection, address, symbol);

            if (!!request.finalized) {
              const message = `your ${symbol.toLowerCase()} token transfer was finalized at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(request.finalized.timestamp).toLowerCase()} (utc) in block: ${request.finalized.hash}.`;
              response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6), [{ socket: chains[symbol].socket, logo: chains[symbol].logo, hash: request.finalized.hash }]);
            } else if (!!request.block) {
              const message = `your ${symbol.toLowerCase()} token transfer was processed at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(request.block.timestamp).toLowerCase()} (utc) in block: ${request.block.hash}.`;
              response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6), [{ socket: chains[symbol].socket, logo: chains[symbol].logo, hash: request.block.hash }]);
            } else if (!!request.transaction) {
              const message = `your ${symbol.toLowerCase()} token transfer was triggered at ${new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(request.transaction.timestamp).toLowerCase()} (utc) in transaction: ${request.transaction.hash}.`;
              response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6));
            } else {
              try {
                const enqued = await sqsClient.send(new SendMessageCommand({
                  MessageBody: event.body,
                  MessageAttributes: {
                    channelId: {
                      DataType: 'String',
                      StringValue: channel_id
                    },
                    userId: {
                      DataType: 'String',
                      StringValue: userId
                    },
                    username: {
                      DataType: 'String',
                      StringValue: member.user.username
                    },
                    interactionId: {
                      DataType: 'String',
                      StringValue: interactionId
                    },
                    interactionToken: {
                      DataType: 'String',
                      StringValue: interactionToken
                    },
                    address: {
                      DataType: 'String',
                      StringValue: address
                    },
                    token: {
                      DataType: 'String',
                      StringValue: symbol
                    },
                  },
                  MessageDeduplicationId: interactionId,
                  MessageGroupId: symbol,
                  QueueUrl: process.env.AWS_SQS_URL,
                }));
                const message = `your ${symbol.toLowerCase()} token request is queued.`;
                response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6));
              } catch (error) {
                console.error(error);
                const message = `your ${symbol.toLowerCase()} token request could not be processed just now. please try later.`;
                response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6));
                break;
              }
            }
          }
          break;
        default:
          response = responseBuilder(404, { message: 'unrecognised type', type });
          break;
      }
    } else {
      response = responseBuilder(403, {
        message: 'signature verification failure',
        request: {
          headers: event.headers,
          method: event.method,
        },
      });
    }
  } catch (error) {
    console.error(error);
    response = responseBuilder(500, { error });
  }
  console.log(response);
  return response;
};
