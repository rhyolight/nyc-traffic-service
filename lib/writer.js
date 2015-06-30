var url = require('url')
  , _ = require('lodash')
  , async = require('async')
  , moment = require('moment-timezone')
  , redis = require('redis')
  , redisUrl = process.env.REDIS_URL
  , redisClient
  , allPathKeys = require('./config').allPathKeys
  , staticPathKeys = require('./config').staticPathKeys
  , pathKeys = _.difference(allPathKeys, staticPathKeys)
  ;

function dateStringToTimestampWithZone(timeIn, zone) {
    // 6/29/2015 16:42:48
    var dateString = timeIn.split(' ').shift()
      , timeString = timeIn.split(' ').pop()
      , datePieces = dateString.split('/')
      , timePieces = timeString.split(':')
      , timeObject = {}
      , timestamp
      ;

    timeObject.month = parseInt(datePieces.shift()) - 1
    timeObject.day = parseInt(datePieces.shift())
    timeObject.year = parseInt(datePieces.shift())
    timeObject.hour = parseInt(timePieces.shift())
    timeObject.minute = parseInt(timePieces.shift())
    timeObject.second = parseInt(timePieces.shift())

    timestamp = moment.tz(timeObject, zone).unix();

    console.log('-- write --');
    console.log('%s ==> %s', timeIn, timestamp);

    return timestamp;
}

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

function writeStaticTypeData(id, data, keys, callback) {
    var writers = [];
    _.each(keys, function(name, index) {
        writers.push(function(err, writeCallback) {
            redisClient.hset('routeProps:' + id, name, data[index], writeCallback);
        });
    });
    async.parallel(writers, callback);
}

function writeDynamicTemporalData(pathId, timeString, data, callback) {
    var timestamp = dateStringToTimestampWithZone(timeString, "America/New_York");
    redisClient.zadd(pathId, timestamp, JSON.stringify(data));
}

function write(data, callback) {
    var headers = data.shift()
      , writers = [];

    _.each(data, function(path) {
        var staticValues = []
          , dynamicValues = []
          , typeValues = {}
          , pathId = path[headers.indexOf('Id')]
          , score = path[headers.indexOf('DataAsOf')];

        _.each(headers, function(headerName, headerIndex) {
            if (_.contains(staticPathKeys, headerName)) {
                // This data property is a static value.
                staticValues.push(path[headerIndex]);
            } else if (_.contains(pathKeys, headerName)) {
                // This data property changes temporally.
                dynamicValues.push(path[headerIndex]);
            }
        });

        writers.push(function(writeCallback) {
            writeStaticTypeData(pathId, staticValues, staticPathKeys, writeCallback);
        });
        writers.push(function(error, writeCallback) {
            writeDynamicTemporalData(pathId, score, dynamicValues, writeCallback);
        });

    });
    async.parallel(writers, callback);
}

module.exports = {
    initialize: initialize
  , write: write
};