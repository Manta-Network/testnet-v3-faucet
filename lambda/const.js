'use strict';

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

module.exports.chains = {
  DOL: { /*id: 1,*/ symbol: "DOL", amount: (BigInt(2000) * BigInt(10 ** 12)), socket: 'wss://ws.calamari.seabird.systems', types, schema: 'sr25519', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/dol.png' },
  KSM: { symbol: "KSM", amount: (BigInt(10) * BigInt(10 ** 12)), socket: 'wss://ws.internal.kusama.systems', schema: 'sr25519', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/ksm.png' },
  KAR: { symbol: "KAR", amount: (BigInt(10) * BigInt(10 ** 12)), socket: 'wss://ws.acala.seabird.systems', options, schema: 'sr25519', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/kar.png' },
  MOVR: { symbol: "MOVR", amount: (BigInt(10) * BigInt(10 ** 18)), socket: 'wss://ws.moonriver.seabird.systems', typesBundle: typesBundlePre900, schema: 'ethereum', logo: 'https://gist.githubusercontent.com/grenade/dc0ff3a062e711db4ad8d4a70ad8bdb2/raw/movr.png' },
};
