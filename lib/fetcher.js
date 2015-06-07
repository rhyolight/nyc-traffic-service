var request = require('request')
  , csvParse = require('csv-parse')
  , listener
    // Currently fetching every 10 minutes
  , INTERVAL = 60000 * 10
  , url = 'http://207.251.86.229/nyc-links-cams/LinkSpeedQuery.txt'
  ;

function fetch(callback) {
    request.get(url, function(err, response, body) {
        csvParse(body, {
            delimiter: '\t'
          , auto_parse: true
          , columns: true
        }, callback);
    });
}

function start(interval) {
    setInterval(function() {
        fetch(listener);
    }, interval);
}

module.exports = function(callback) {
    listener = callback;
    fetch(function(error, data) {
        callback(error, data);
        start(INTERVAL);
    });
};