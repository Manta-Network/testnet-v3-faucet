'use strict';

const day = () => (new Date().toISOString().slice(0, 10));
const filter = (address, symbol) => ({
  address,
  symbol,
  day: day(),
});

module.exports.getOverview = async (collection) => (
  await collection.aggregate([
    {
      $group: {
        _id: {
          day: "$day",
          symbol: "$symbol",
        },
        count: { $sum: 1 }
      }
    }
  ]).toArray()
);

module.exports.getRequests = async (collection, address) => (
  await collection.find(
    {
      address,
    },
    {
      projection: {
        _id: false,
      },
    }
  ).toArray()
);

module.exports.getRequest = async (collection, address, symbol) => (
  await collection.findOne(
    filter(address, symbol),
    {
      projection: {
        _id: false,
      },
    }
  )
);

module.exports.putRequest = async (collection, address, symbol, event) => {
  const eventUpdate = {
    $set: {
      address,
      symbol,
      day: day(),
      ...(!!event && !!event.block) && {
        block: event.block,
      },
      ...(!!event && !!event.transaction) && {
        transaction: event.transaction,
      },
      ...(!!event && !!event.finalized) && {
        finalized: event.finalized,
      },
    },
  };
  const options = {
    upsert: true
  };
  const eventResult = await collection.updateOne(filter(address, symbol), eventUpdate, options);
  console.log(`event: ${eventResult.matchedCount} document(s) matched the filter, updated ${eventResult.modifiedCount} document(s)`);
  if (!!event && !!event.interaction) {
    const interactionUpdate = {
      $push: {
        interactions: event.interaction,
      },
    };
    const interactionResult = await collection.updateOne(filter(address, symbol), interactionUpdate, options);
    console.log(`interaction: ${interactionResult.matchedCount} document(s) matched the filter, updated ${interactionResult.modifiedCount} document(s)`);
  }
};
