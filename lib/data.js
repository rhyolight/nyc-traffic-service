var url = require('url')
  , qs = require('querystring')
  , _ = require('lodash')
  , redis = require('redis')
  , jsonUtils = require('./json')
  , redisUrl = process.env.REDIS_URL
  , redisClient
  ;

function isInt(value) {
    return ! isNaN(value)
        && parseInt(Number(value)) == value
        && ! isNaN(parseInt(value, 10));
}

function writeKeys(query, res) {
    redisClient.keys('*', function(error, keys) {
        var intKeys;
        if (error) {
            jsonUtils.renderErrors([error], res, query.callback);
        } else {
            intKeys = _.map(keys, function(id) {
                return parseInt(id);
            }).sort(function(a, b) { return a - b;});
            jsonUtils.render({
                pathIds: intKeys
              , count: intKeys.length
            }, res, query.callback);
        }
    });
}

function writeRouteData(id, query, res) {
    var since = query.since || '-inf'
      , until = query.until || '+inf'
      ;

    redisClient.zrangebyscore(id, since, until, function(error, values) {
        var data = _.map(values, function(value) {
            return JSON.parse(value);
        });
        if (error) {
            jsonUtils.renderErrors([error], res, query.callback);
        } else if (! values.length) {
            res.status(404).send('Not found');
        } else {
            jsonUtils.render({
                path: data
              , count: data.length
            }, res, query.callback);
        }
    });
}

function trafficData(req, res) {
    var trafficRouteId
      , requestUrl = url.parse(req.url)
      , query = qs.parse(requestUrl.query)
      ;
    
    if (! req.params || ! req.params.trafficRoute) {
        res.status(404).send('Not found');
    } else if (req.params.trafficRoute == 'paths') {
        writeKeys(query, res);
    } else if (isInt(req.params.trafficRoute)) {
        trafficRouteId = parseInt(req.params.trafficRoute);
        writeRouteData(trafficRouteId, query, res);
    } else {
        res.status(404).send('Not found');
    }
}

function initialize(callback) {
    console.log('Data service connecting to Redis at %s...', redisUrl);
    var connection = url.parse(redisUrl);
    redisClient = redis.createClient(connection.port, connection.hostname);
    if (connection.auth) {
        redisClient.auth(connection.auth.split(":")[1]);
    }
    redisClient.on('connect', function() {
        console.log('Data service connected to Redis!');
        callback(null, trafficData);
    });
    redisClient.on('error', function(error) {
        callback(error);
    });
}

// This service queries redis for traffic data in response to HTTP requests.
module.exports = initialize;
