var express = require('express')
  , fetcher = require('./fetcher')
  , writer = require('./writer')
  , dataServiceInitializer = require('./data')
  , app = express()
  , port = process.env.PORT || 8080
  ;

writer.initialize(function(connectionError) {
    if (connectionError) {
        console.log(connectionError);
        process.exit(-1);
    }
    fetcher(function(fetchError, data) {
        // This is called every minute with new data.
        if (fetchError) {
            console.error('Error fetching new data:');
            console.error(fetchError);
        } else {
            console.log('Got new data...');
            writer.write(data, function(writeError) {
                if (writeError) {
                    console.error('Error writing new data:');
                    console.error(writeError);
                } else {
                    console.log('Wrote new path data.');
                }
            });
        }
    });
});

dataServiceInitializer(function(connectionError, requestHandler) {
    if (connectionError) {
        console.log(connectionError);
        process.exit(-1);
    }
    app.use('/:trafficRoute', requestHandler);
    app.listen(port, function(error) {
        if (error) return console.error(error);
        console.log('http://localhost:%s', port);
    });
});
