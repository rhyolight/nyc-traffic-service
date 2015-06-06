var url = require('url')
  , moment = require('moment-timezone')
  , redis = require('redis')
  , redisUrl
  , client
  ;

function initialize(callback) {
    console.log('Writer connecting to Redis at %s...', process.env.REDIS_URL);
    redisUrl = url.parse(process.env.REDIS_URL);
    client = redis.createClient(redisUrl.port, redisUrl.hostname);
    if (redisUrl.auth) {
        client.auth(redisUrl.auth.split(":")[1]);
    }
    client.on('connect', function() {
        console.log('Writer connected to Redis!');
        callback();
    });
    client.on('error', function(error) {
        callback(error);
    });
}

function write(data, callback) {
    var writeCount = 0;
    data.forEach(function(path) {
        var id = path.Id
          , timeString = path.DataAsOf
          , time = moment.tz(new Date(timeString), "America/New_York")
          , timestamp = time.unix()
          ;
        client.zadd(path.Id, timestamp, JSON.stringify(path));
        writeCount++;
    });
    console.log('Wrote %s paths', writeCount);
    callback();
}

module.exports = {
    initialize: initialize
  , write: write
};