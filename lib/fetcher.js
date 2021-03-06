var request = require('request')
  , csvParse = require('csv-parse')
  , config = require('./config')
  , listener
    // fetch interval is in minutes, so convert to milliseconds
  , interval = config.fetchInterval * 1000 * 60
  , url = 'http://207.251.86.229/nyc-links-cams/LinkSpeedQuery.txt'
  ;

function fetch(callback) {
    request.get(url, function(err, response, body) {
        csvParse(body, {
            delimiter: '\t'
          , auto_parse: true
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
        start(interval);
    });
};