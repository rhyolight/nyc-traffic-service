var url = require('url')
  , _ = require('lodash')
  , moment = require('moment-timezone')
  , redis = require('redis')
  , redisUrl = process.env.REDIS_URL
  , redisClient
  , pathKeys = require('./config').pathKeys
  ;

function initialize(callback) {
    var connection = url.parse(redisUrl);
    console.log('Writer connecting to Redis at %s...', redisUrl);
    redisClient = redis.createClient(connection.port, connection.hostname);
    if (connection.auth) {
        redisClient.auth(connection.auth.split(":")[1]);
    }
    redisClient.on('connect', function() {
        console.log('Writer connected to Redis!');
        callback();
    });
    redisClient.on('error', function(error) {
        callback(error);
    });
}

function compressPathData(data, keys) {
    var compressedOut = [];
    _.each(data, function(value, key) {
        if (_.contains(keys, key)) {
            compressedOut.push(value);
        }
    });
    return compressedOut;
}

function write(data, callback) {
    var writeCount = 0;
    _.each(data, function(path) {
        var timeString = path.DataAsOf
          , time = moment.tz(new Date(timeString), "America/New_York")
          , timestamp = time.unix()
          , compressedData = compressPathData(path, pathKeys)
          ;
        redisClient.zadd(path.Id, timestamp, JSON.stringify(compressedData));
        writeCount++;
    });
    console.log('Wrote %s paths', writeCount);
    callback();
}

module.exports = {
    initialize: initialize
  , write: write
};