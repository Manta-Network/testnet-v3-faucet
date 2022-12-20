const aws = require('aws-sdk');
aws.config.update({ region: 'us-east-2' });

const docClient = new aws.DynamoDB.DocumentClient();
const ADDRESS_LIMIT = parseInt(process.env['ADDRESS_LIMIT']);
const REQUEST_LIMIT = parseInt(process.env['REQUEST_LIMIT']);

class RequestLimits {
    constructor(num_coins, log_entry) {
        this.log_entry = log_entry;
        this.num_coins = num_coins;
    }

    async check_address(token, address, start_time) {
        let tokens = new Set();

        let params =  {
          ConsistentRead: true,
          TableName: 'faucet-requests',
          KeyConditionExpression: '#addr = :addr and #req > :req',
          ExpressionAttributeValues: { ':addr': address, ':req': start_time },
          ExpressionAttributeNames: { '#addr': 'address', '#req': 'last-request' },
        };

        let response = await docClient.query(params).promise();
        response.Items.forEach(item => tokens.add(item.token));
        return tokens;
    }

    async check_id(token, id, start_time) {
        let addresses = new Set();

        let params =  {
          TableName: 'faucet-requests',
          IndexName: 'user-id-last-request-index',
          KeyConditionExpression: '#id = :id and #req > :req',
          ExpressionAttributeValues: { ':id': id, ':req': start_time },
          ExpressionAttributeNames: { '#id': 'user-id', '#req': 'last-request' },
        };

        let response = await docClient.query(params).promise();
        response.Items.forEach(item => addresses.add(item.address))

        return addresses;
    }

    async record_entry(token, id, address, time) {
        let params =  {
          TableName: 'faucet-requests',
          Item: {
              'user-id': id,
              'address': address,
              'token': token,
              'last-request': time,
          }
        };

        return docClient.put(params).promise();
    }

    async check(token, user, address) {
        const now = Date.now();
        const limit = now - REQUEST_LIMIT*1000;

        const f = await this.check_id(token, user, limit);

        if (f.size == ADDRESS_LIMIT && !f.has(address)) {
            const message = `Request limit is ${ADDRESS_LIMIT} addresses per user`;
            return {
                error: true,
                message: message,
            };
        }

        const q = await this.check_address(token, address, limit);
        if (q.size == this.num_coins || q.has(token)) {
            const message  = "Limit one of each token per address per day.";
            return {
                error: true,
                message: message,
            };
        }

        if (this.log_entry) {
            await this.record_entry(token, user, address, now);
        }
        return { error: false };
    }
}


module.exports.RequestLimits = RequestLimits;
