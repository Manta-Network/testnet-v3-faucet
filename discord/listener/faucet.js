const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
//const BN = require('bn.js');
const { getFailedExtrinsicError } = require('./failed');
const { RequestLimits } = require('./limit');
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
}

const COINS = {
  DOL: { id: 1, symbol: "DOL", amount: (BigInt(100) * BigInt(10 ** 12)), socket: "wss://ws.calamari.seabird.systems", types: types },
  KSM: { symbol: "KSM", amount: (BigInt(10) * BigInt(10 ** 12)), socket: "wss://ws.internal.kusama.systems" },
  KAR: { symbol: "KAR", amount: (BigInt(10) * BigInt(10 ** 12)), socket: "wss://ws.acala.seabird.systems", options: options },
  MOVR: { symbol: "MOVR", amount: (BigInt(10) * BigInt(10 ** 18)), socket: "wss://ws.moonriver.seabird.systems", typesBundle: typesBundlePre900},
};

class Faucet {
  constructor(client, account) {
    console.log('Constructing faucet');
    this.apiByCoinName = {};
    for (const key in COINS) {
      try {
        const coin = COINS[key]
        const provider = new WsProvider(coin.socket);
        const apiTypes = coin.types;
        const apiTypesBundle = coin.typesBundle;
        const apiOptions = coin.options;
        const apiPromise = (apiOptions)
          ? ApiPromise.create(apiOptions({ provider, types: apiTypes,}))
          : ApiPromise.create({provider, types: apiTypes, typesBundle: apiTypesBundle});
        this.apiByCoinName[coin.symbol] = apiPromise;
      } catch (error) {
        console.error(error);
      }
    }
    console.log('Finished constructing apis');
    this.discord_client = client;
    this.account = account;
    this.request_limits = new RequestLimits(Object.keys(COINS).length, true);
  }

  async send_token(token, channel, address, userId) {
    console.log('call to send_token with parameters: ', token, channel, address);
    const api = await this.apiByCoinName[token];
    await api.isReady;
    if (!this.faucet) {
      const keyring = new Keyring({ type: 'sr25519' });
      this.faucet = keyring.addFromMnemonic(this.account);
    }
    const nonce = await api.rpc.system.accountNextIndex(this.faucet.address);

    const txResHandler = async (result) => {
      if (result.status.isFinalized) {
        const msg = getFailedExtrinsicError(result.events, api);
        if (msg != null) {
          await channel.send(`<@${userId}> ${coin.symbol} transfer failed: ${msg}`);
        } else {
          const id = result.status.asFinalized.toHex();
          await channel.send(`<@${userId}> ${coin.symbol} transfer complete: ${id}`);
        }
        unsub();
      } else if (result.status.isInBlock) {
        console.log(`transaction status: in-block`);
      } else {
        console.log(`transaction status: ${JSON.stringify(result)}`);
      }
    }
    const coin = COINS[token];
    try {
      console.log(`INFO: trying to send ${coin.amount} of ${token}`);
      const unsub = (['DOLXXX', 'KMAXXX'].includes(token))
        ? await api.tx.mantaPay
          .publicTransfer({ id: coin.id, value: coin.amount.toString() }, address)
          .signAndSend(this.faucet, { nonce }, txResHandler)
        : await api.tx.balances
          .transfer(address, coin.amount)
          .signAndSend(this.faucet, { nonce }, txResHandler);
      await channel.send(`<@${userId}> check your ${coin.symbol} balance...`);
    } catch (error) {
      console.log(error);
      await channel.send(`<@${userId}> i checked but it seems i'm not as flush with ${coin.symbol} as i'd like to be. maybe some other time.`);
    }
  }

  async process_transfer(request) {
    const userId = request.user_id;
    const address = request.address;
    const channel_id = request.channel_id;
    const token = request.token;
    const channel = this.discord_client.channels.cache.get(channel_id);
    const response = this.request_limits.check(token, userId, address);
    if (response.error) {
      await channel.send(`<@${userId}> ${response.message}`);
    } else {
      await this.send_token(token, channel, address, userId);
    }
  }
}

module.exports.Faucet = Faucet
