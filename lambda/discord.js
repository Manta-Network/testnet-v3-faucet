'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const nacl = require('tweetnacl');
const { decodeAddress } = require('@polkadot/keyring');
const sqsClient = new SQSClient({ region: 'us-east-2' });
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

module.exports.interactions = async (event) => {
  let response;
  try {
    const valid = nacl.sign.detached.verify(
      Buffer.from(event.headers['x-signature-timestamp'] + event.body),
      Buffer.from(event.headers['x-signature-ed25519'], 'hex'),
      Buffer.from(process.env.DISCORD_APPLICATION_PUBLIC_KEY, 'hex'));
    if (valid) {
      const { channel_id, data, member, type } = JSON.parse(event.body);
      switch (type) {
        case 1:
          response = {
            ...defaultResponse,
            statusCode: 200,
            body: JSON.stringify({ type: 1 }, null, 2 ),
          };
          break;
        case 2:
          const command = data.name;
          const token = knownCommands[command];
          if (token === undefined) {
            response = {
              ...defaultResponse,
              statusCode: 404,
              body: JSON.stringify({ message: 'unrecognised command', command }, null, 2 ),
            };
          } else if (channel_id !== process.env.DISCORD_CHANNEL_ID) {
            response = {
              ...defaultResponse,
              statusCode: 200,
              body: JSON.stringify(
                {
                  type: 4,
                  data: {
                    allowed_mentions: {
                      parse: [
                        'users'
                      ],
                      users: []
                    },
                    content: `please send your faucet requests to <#${process.env.DISCORD_CHANNEL_ID}> channel`,
                    flags: (1<<6),
                  },
                },
                null,
                2
              ),
            };
          } else {
            const userId = member.user.id;
            const answer = {
              yes: [
                `i'll see what i can do`,
                `i'll think about it`,
                `i'm thinking about it`,
                `the cheque's in the post`,
                `ok, why not`,
                `maybe i'll help you`,
              ],
              no: [
                `i don't think so. try me later...`,
                `i don't feel like it. try me later...`,
                `i'm washing my hair. try me later...`,
                `i'm busy. try me later...`,
                `some other time`,
                `i can't find my wallet right now. try me later...`,
                `i'm not in the mood. try me later...`,
              ],
            };
            try {
              decodeAddress(data.options[0].value);
            } catch (error) {
              console.error(error);
              response = {
                ...defaultResponse,
                statusCode: 200,
                body: JSON.stringify(
                  {
                    type: 4,
                    data: {
                      allowed_mentions: {
                        parse: [
                          'users'
                        ],
                        users: []
                      },
                      content: `<@${userId}> the given address is not a valid ${knownCommands[command].toLowerCase()} account`,
                      flags: 0,
                    },
                  },
                  null,
                  2
                ),
              };
              break;
            }
            try {
              const enqued = await sqsClient.send(new SendMessageCommand({
                MessageBody: JSON.stringify({
                  channel_id,
                  address: data.options[0].value,
                  user_id:  member.user.id,
                  token: token,
                }),
                MessageDeduplicationId: member.user.id,
                MessageGroupId: token,
                QueueUrl: process.env.AWS_SQS_URL,
              }));
              response = {
                ...defaultResponse,
                statusCode: 200,
                body: JSON.stringify(
                  {
                    type: 4,
                    data: {
                      allowed_mentions: {
                        parse: [
                          'users'
                        ],
                        users: []
                      },
                      content: `<@${userId}> ${answer.yes[Math.floor((Math.random() * answer.yes.length))]}`,
                      flags: 0,
                    },
                  },
                  null,
                  2
                ),
              };
            } catch (error) {
              console.error(error);
              response = {
                ...defaultResponse,
                statusCode: 200,
                body: JSON.stringify(
                  {
                    type: 4,
                    data: {
                      allowed_mentions: {
                        parse: [
                          'users'
                        ],
                        users: []
                      },
                      content: `<@${userId}> ${answer.no[Math.floor((Math.random() * answer.no.length))]}`,
                      flags: 0,
                    },
                  },
                  null,
                  2
                ),
              };
              break;
            }
          }
          break;
        default:
          response = {
            ...defaultResponse,
            statusCode: 404,
            body: JSON.stringify({ message: 'unrecognised type', type }, null, 2 ),
          };
          break;
      }
    } else {
      response = {
        ...defaultResponse,
        statusCode: 403,
        body: JSON.stringify(
          {
            message: 'signature verification failure',
            request: {
              headers: event.headers,
              method: event.method,
            },
          },
          null,
          2
        ),
      };
    }
  } catch (error) {
    console.error(error);
    response = {
      ...defaultResponse,
      statusCode: 500,
      body: JSON.stringify({ error }, null, 2),
    };
  }
  console.log(response);
  return response;
};
