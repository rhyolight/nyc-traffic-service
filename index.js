var express = require('express')
  , fetcher = require('./fetcher')
  , writer = require('./writer')
  , dataServiceInitializer = require('./data')
  , app = express()
  , port = process.env.PORT || 8080
  , host = process.env.BASE_URI || 'http://localhost'
  ;

// Fail fast.
if (! process.env.REDIS_URL) {
    throw new Error('Missing environment variable REDIS_URL.');
}

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
                    console.log('Wrote new traffic data.');
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
    app.use('/:trafficRoute', requestHandler);
    app.listen(port, function(error) {
        if (error) return console.error(error);
        console.log('%s:%s', host, port);
    });
});
