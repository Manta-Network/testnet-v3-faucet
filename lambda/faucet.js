'use strict';

const fetch = require('node-fetch');
const { SQSClient, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-east-2' });
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { options } = require('@acala-network/api');
const { typesBundlePre900 } = require('moonbeam-types-bundle');
const types = {
  "Checkpoint": {
    "receiver_index": "[u64; 256]",
    "sender_index": "u64"
  },
  "Asset": {
    "id": "[u8; 32]",
    "value": "[u8; 16]"
  },
  "Utxo": {
    "is_transparent": "bool",
    "public_asset": "Asset",
    "commitment": "[u8; 32]"
  },
  "IncomingNote": {
    "ephemeral_public_key": "[u8; 32]",
    "tag": "[u8; 32]",
    "ciphertext": "[[u8; 32]; 3]"
  },
  "LightIncomingNote": {
    "ephemeral_public_key": "[u8; 32]",
    "ciphertext": "[[u8; 32]; 3]"
  },
  "FullIncomingNote": {
    "address_partition": "u8",
    "incoming_note": "IncomingNote",
    "light_incoming_note": "LightIncomingNote"
  },
  "OutgoingNote": {
    "ephemeral_public_key": "[u8; 32]",
    "ciphertext": "[[u8; 32]; 2]"
  },
  "PullResponse": {
    "should_continue": "bool",
    "receivers": "Vec<(Utxo, FullIncomingNote)>",
    "senders": "Vec<([u8; 32], OutgoingNote)>"
  },
  "AuthorizationSignature": {
    "authorization_key": "[u8; 32]",
    "signature": "([u8; 32], [u8; 32])"
  },
  "SenderPost": {
    "utxo_accumulator_output": "[u8; 32]",
    "nullifier_commitment": "[u8; 32]",
    "outgoing_note": "OutgoingNote"
  },
  "ReceiverPost": {
    "utxo": "Utxo",
    "note": "FullIncomingNote"
  },
  "TransferPost": {
    "authorization_signature": "Option<AuthorizationSignature>",
    "asset_id": "Option<[u8; 32]>",
    "sources": "Vec<[u8; 16]>",
    "sender_posts": "Vec<SenderPost>",
    "receiver_posts": "Vec<ReceiverPost>",
    "sinks": "Vec<[u8; 16]>",
    "proof": "[u8; 128]"
  }
};

const getExtrinsicError = function (events, api) {
  let errorMessage = null;
  events
    .filter(
      ({ event }) =>
        api.events.system.ExtrinsicFailed.is(event) ||
        api.events.utility.BatchInterrupted.is(event)
    )
    .forEach(
      ({
        event: {
          data: [error, info],
        },
      }) => {
        if (error.isModule) {
          // for module errors, we have the section indexed, lookup
          const decoded = api.registry.findMetaError(error.asModule);
          const { documentation = [], method, section } = decoded;
          errorMessage = `${section}.${method}: ${documentation.join(' ')}`;
        } else {
          // Other, CannotLookup, BadOrigin, no extra info
          errorMessage = error.toString();
        }
      }
    );
  return errorMessage;
}

const txResponseHandler = async (result, api, token, interaction) => {
  if (!!result.txHash) {
    console.log(`transaction status: ${JSON.stringify(result)}`);
    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `<@${interaction.user.id}> your ${token.toLowerCase()} tokens were sent in tx: ${result.txHash}`,
        ...(token === 'DOL') && {
          embeds: [
            {
              title: 'view on subscan',
              url: `https://dolphin.subscan.io/extrinsic/${result.txHash}`,
              type: 'rich',
              thumbnail: {
                url: 'https://raw.githubusercontent.com/Manta-Network/Logos/main/dolphin/dolphin_logo.png',
                height: 50,
                width: 50,
              },
            }
          ]
        },
      })
    };
    const original = await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, options);
    const { id } = await original.json();
    const update = await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/${id}`, options);
    const json = await update.json();
    console.log(`discord update: ${JSON.stringify(json)}`);
  } else {
    console.log(`transaction status: ${JSON.stringify(result)}`);
  }
}

const sendToken = async (token, address, interaction) => {
  const { amount, id, options, schema, socket, types, typesBundle } = chains[token];
  const provider = new WsProvider(socket);
  const api = await ApiPromise.create((!!options) ? options({ provider, types }) : ({ provider, types, typesBundle }));
  await Promise.all([ api.isReady, cryptoWaitReady() ]);
  const faucet = (new Keyring({ type: schema })).addFromMnemonic(process.env.FAUCET_MNEMONIC);
  const nonce = await api.rpc.system.accountNextIndex(faucet.address);
  let message;
  try {
    const unsub = (!!id)
      ? await api.tx.mantaPay
        .publicTransfer({ id, value: amount.toString() }, address)
        .signAndSend(faucet, { nonce }, (response) => txResponseHandler(response, api, token, interaction))
      : await api.tx.balances
        .transfer(address, amount)
        .signAndSend(faucet, { nonce }, (response) => txResponseHandler(response, api, token, interaction));
    message = `check your ${token.toLowerCase()} balance. i've sent you tokens.`;
  } catch (error) {
    console.error(error);
    message = `i'm unable to send you ${token.toLowerCase()} token at this time. please try later.`;
  }
  return message;
};

const chains = {
  DOL: { /*id: 1,*/ symbol: "DOL", amount: (BigInt(100) * BigInt(10 ** 12)), socket: 'wss://ws.calamari.seabird.systems', types, schema: 'sr25519' },
  KSM: { symbol: "KSM", amount: (BigInt(10) * BigInt(10 ** 12)), socket: 'wss://ws.internal.kusama.systems', schema: 'sr25519' },
  KAR: { symbol: "KAR", amount: (BigInt(10) * BigInt(10 ** 12)), socket: 'wss://ws.acala.seabird.systems', options, schema: 'sr25519' },
  MOVR: { symbol: "MOVR", amount: (BigInt(10) * BigInt(10 ** 18)), socket: 'wss://ws.moonriver.seabird.systems', typesBundle: typesBundlePre900, schema: 'sr25519' },
};

module.exports.open = async (event) => {
  const results = await Promise.all(event.Records.map(async ({ messageAttributes, receiptHandle }) => {
    const interaction = {
      id: messageAttributes.interactionId.stringValue,
      token: messageAttributes.interactionToken.stringValue,
      user: {
        id: messageAttributes.userId.stringValue,
      },
    };
    const [
      message,
      sqsDelete,
    ] = await Promise.all([
      sendToken(messageAttributes.token.stringValue, messageAttributes.address.stringValue, interaction),
      sqsClient.send(new DeleteMessageCommand({ QueueUrl: process.env.AWS_SQS_URL, ReceiptHandle: receiptHandle })),
    ]);
    return {
      message,
      interaction,
    };
  }));
  
};