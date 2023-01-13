'use strict';

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { chains } = require('./const');
const { MongoClient } = require('mongodb');
const {
  getOverview,
  getRequests,
} = require('./crud');

const defaultResponse = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};

const responseBuilder = (statusCode, body) => {
  return {
    ...defaultResponse,
    statusCode,
    body: JSON.stringify(
      body,
      (k, v) => ((typeof v === 'bigint') ? v.toString() : v),
      2
    ),
  };
};

const balance = async (symbol, address) => {
  const { amount, id, options, schema, socket, types, typesBundle } = chains[symbol];
  const provider = new WsProvider(socket);
  const api = await ApiPromise.create((!!options) ? options({ provider, types }) : ({ provider, types, typesBundle }));
  await api.isReady;
  const { data } = await api.query.system.account(address);
  const balance = (BigInt(data.free) / BigInt(10 ** ((symbol === 'MOVR') ? 18 : 12)));
  return {
    address,
    drip: (BigInt(amount) / BigInt(10 ** ((symbol === 'MOVR') ? 18 : 12))),
    symbol,
    balance: balance,
  };
};

const balances = async () => (
  await Promise.all(Object.keys(chains).map(
    (symbol) => balance(
      symbol,
      (symbol === 'MOVR')
        ? '0x9CeaA13D62deaD6E91Dc94A9f35E2710099e0929'
        : '5ELaBtWzFzB8S2DNfvwCHRCQNYjFwKojsnJhHokKLR8zsBtE')
    )
  )
);

module.exports.overview = async (event) => {
  let response;
  try {
    const mongoClient = await MongoClient.connect(process.env.FAUCET_DATABASE_URI);
    const database = await mongoClient.db('testnet_v3_faucet');
    const collection = await database.collection('request');
    const overview = await getOverview(collection);
    const body = { overview };
    response = responseBuilder(200, body);
  }
  catch (error) {
    console.error(error);
    response = responseBuilder(500, { error });
  }
  console.log(response);
  return response;
};

module.exports.address = async (event) => {
  const { address } = event.pathParameters;
  let response;
  try {
    const mongoClient = await MongoClient.connect(process.env.FAUCET_DATABASE_URI);
    const database = await mongoClient.db('testnet_v3_faucet');
    const collection = await database.collection('request');
    const requests = await getRequests(collection, address);
    const body = { requests };
    response = responseBuilder(200, body);
  }
  catch (error) {
    console.error(error);
    response = responseBuilder(500, { error });
  }
  console.log(response);
  return response;
};

module.exports.health = async (event) => {
  let response;
  try {
    const body = { 
      balances: await balances(),
    };
    response = responseBuilder(200, body);
  }
  catch (error) {
    console.error(error);
    response = responseBuilder(500, { error });
  }
  console.log(response);
  return response;
};
