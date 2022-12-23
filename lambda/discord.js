'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-east-2' });
const nacl = require('tweetnacl');
const { decodeAddress } = require('@polkadot/keyring');

const defaultResponse = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};
const knownCommands = {
  'gimme-dol': 'DOL',
  'gimme-kar': 'KAR',
  'gimme-ksm': 'KSM',
  'gimme-movr': 'MOVR',
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

const discordResponseBuilder = (content, flags) => responseBuilder(
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
          const token = knownCommands[command];
          if (token === undefined) {
            response = responseBuilder(404, { message: 'unrecognised command', command });
          } else if (channel_id !== process.env.DISCORD_CHANNEL_ID) {
            response = discordResponseBuilder(`<@${member.user.id}> please send your faucet requests to <#${process.env.DISCORD_CHANNEL_ID}> channel`, (1<<6));
          } else {
            const userId = member.user.id;
            try {
              decodeAddress(data.options[0].value);
            } catch (error) {
              console.error(error);
              response = discordResponseBuilder(`<@${userId}> the given address is not a valid ${knownCommands[command].toLowerCase()} account`, (1<<6));
              break;
            }
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
                    StringValue: data.options[0].value
                  },
                  token: {
                    DataType: 'String',
                    StringValue: token
                  },
                },
                MessageDeduplicationId: interactionId,
                MessageGroupId: token,
                QueueUrl: process.env.AWS_SQS_URL,
              }));
              const message = `your ${token.toLowerCase()} token request is queued.`;
              response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6));
            } catch (error) {
              console.error(error);
              const message = `your ${token.toLowerCase()} token request could not be processed just now. please try later.`;
              response = discordResponseBuilder(`<@${userId}> ${message}`, (1<<6));
              break;
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
