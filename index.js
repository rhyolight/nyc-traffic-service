var express = require('express')
  , fetcher = require('./lib/fetcher')
  , writer = require('./lib/writer')
  , buildStaticSite = require('./lib/smithy')
  , dataServiceInitializer = require('./lib/data')
  , config = require('./lib/config')
  , app = express()
  ;

// Fail fast.
if (! process.env.REDIS_URL) {
    throw new Error('Missing environment variable REDIS_URL.');
}

console.log(config);

// We initialize the redis writer first.
writer.initialize(function(connectionError) {
    if (connectionError) {
        console.log(connectionError);
        process.exit(-1);
    }
    // The callback sent to the fetcher will be called every minute with new data
    // that needs to be stored in redis by the writer initialized above.
    fetcher(function(fetchError, data) {
        if (fetchError) {
            console.error('Error fetching new traffic data:');
            console.error(fetchError);
        } else {
            // Writes new traffic data to redis.
            writer.write(data, function(writeError) {
                if (writeError) {
                    console.error('Error writing new traffic data:');
                    console.error(writeError);
                } else {
                    console.log('Write completed at %s', new Date().toString());
                }
            });
        }
    });
});

// The data service exposes HTTP endpoints so users can query the traffic data
// stored in redis by the fetcher and writer above.
dataServiceInitializer(function(connectionError, requestHandler) {
    if (connectionError) {
        console.log(connectionError);
        process.exit(-1);
    }
    buildStaticSite();
    app.use(express.static('build'));
    app.use('/:trafficRoute*', requestHandler);
    app.listen(config.port, function(error) {
        if (error) return console.error(error);
        console.log('%s:%s', config.host, config.port);
    });
});
