const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const BN = require('bn.js');
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
    //KMA: { id: 1, symbol: "KMA", amount: new BN(100) * new BN(10).pow(new BN(18)), socket: "wss://ws.calamari.seabird.systems", types: types },
    DOL: { id: 1, symbol: "DOL", amount: new BN(100) * new BN(10).pow(new BN(18)), socket: "wss://ws.dolphin.seabird.systems", types: types },
    KSM: { symbol: "KSM", amount: new BN(10) * new BN(10).pow(new BN(12)), socket: "wss://ws.internal.kusama.systems" },
    KAR: { symbol: "KAR", amount: new BN(10) * new BN(10).pow(new BN(12)), socket: "wss://ws.acala.seabird.systems", options: options },
    MOVR: { symbol: "MOVR", amount: new BN(10) * new BN(10).pow(new BN(18)), socket: "wss://ws.moonriver.seabird.systems", typesBundle: typesBundlePre900},
};

class Faucet {
    constructor(client, account) {
      console.log('Constructing faucet');
        this.apiByCoinName = {};
        for (const key in COINS) {
            const coin = COINS[key]
            const provider = new WsProvider(coin.socket);

            const apiTypes = coin.types;
            const apiTypesBundle = coin.typesBundle;
            const apiOptions = coin.options;

            let apiPromise;
            if (apiOptions) {
              apiPromise = ApiPromise.create(apiOptions({ provider, types: apiTypes,}));
            } else {
              apiPromise = ApiPromise.create({provider, types: apiTypes, typesBundle: apiTypesBundle});
            }
            this.apiByCoinName[coin.symbol] = apiPromise;
        }
        console.log('Finished constructing apis');
        this.discord_client = client;
        this.account = account;
        this.request_limits = new RequestLimits(Object.keys(COINS).length, true);
    }

    async send_token(token, channel, address) {
      // const api =
      // if (this.api == null) {
        //     this.api = await this.apiPromise;
        //     await this.api.isReady;
        //     const keyring = new Keyring({ type: 'sr25519' });
        //     this.faucet = keyring.addFromMnemonic(this.account);
        // }
        console.log('call to send_token with parameters: ', token, channel, address);
        const api = this.apiByCoinName[token];
        await api.isReady;
        if (!this.faucet) {
          const keyring = new Keyring({ type: 'sr25519' });
          this.faucet = keyring.addFromMnemonic(this.account);
        }
        //let nonce = await api.rpc.system.accountNextIndex(this.faucet.address);
        const { nonce } = api.query.system.account(this.faucet.address);

        const txResHandler = (result) => {
            if (result.status.isFinalized) {
                const msg = getFailedExtrinsicError(result.events, api);
                if (msg != null) {
                    channel.send(`${coin.symbol} transfer failed: ${msg}`);
                } else {
                    const id = result.status.asFinalized.toHex();
                    channel.send(`${coin.symbol} transfer complete: ${id}`);
                }
                unsub();
            } else if (result.status.isInBlock) {
                console.log(`INBLOCK`);
            } else {
                console.log(`Something else happened.`);
            }
        }

        const coin = COINS[token];
        try {

            console.log(`INFO: trying to send ${coin.amount} of ${token}`);
            if (DOIN[symbol] == "DOL") {
                const unsub = await api.tx.mantaPay
                    .publicTransfer({ id: coin.id, value: coin.amount.toString() }, address)
                    .signAndSend(this.faucet, { nonce }, txResHandler);
            } else {
                const unsub = await api.tx.balances
                    .transfer(address, value)
                    .signAndSend(this.faucet, { nonce }, txResHandler);
            }

        } catch (error) {
            console.log(error);
            channel.send(`${coin.symbol} transers failed!`);
        }
    }

    async process_transfer(request) {
        const user_id = request.user_id;
        const address = request.address;
        const channel_id = request.channel_id;
        const token = request.token;
        const channel = this.discord_client.channels.cache.get(channel_id);
        const response = this.request_limits.check(token, user_id, address);
        if (response.error) {
            message = `<@${user_id}> ${response.message}`;
            await channel.send(message);
        } else {
            await this.send_token(token, channel, address);
        }
    }
}

module.exports.Faucet = Faucet
