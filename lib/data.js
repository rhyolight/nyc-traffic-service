var url = require('url')
  , path = require('path')
  , qs = require('querystring')
  , _ = require('lodash')
  , redis = require('redis')
  , jsonUtils = require('./json')
  , redisUrl = process.env.REDIS_URL
  , redisClient
  , pathKeys = require('./config').pathKeys
  ;

function isInt(value) {
    return ! isNaN(value)
        && parseInt(Number(value)) == value
        && ! isNaN(parseInt(value, 10));
}

function unCompressPathData(data, keys) {
    var uncompressedOut = {};
    keys.forEach(function(key, index) {
        uncompressedOut[key] = data[index];
    });
    return uncompressedOut;
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

function respondInJson(error, data, callback, res) {
    if (error) {
        jsonUtils.renderErrors([error], res, query.callback);
    } else if (! data.length) {
        res.status(404).send('Not found');
    } else {
        jsonUtils.render({
            path: data
          , count: data.length
        }, res, callback);
    }
}

function respondInCsv(error, data, res) {
    var csvKeys = ['DataAsOf', 'Speed', 'TravelTime']
      , csv = '';
    res.setHeader('Content-Type', 'text');
    if (error) {
        res.statusCode = 400;
        res.end(error.message);
    } else if (! data.length) {
        res.status(404).send('Not found');
    } else {
        // Headers are the keys
        csv += csvKeys.join(',') + '\n';
        _.each(data, function(pathData, index) {
            var rowOut = _.map(csvKeys, function(key) {
                return pathData[key];
            }).join(',') + '\n';
            csv += rowOut;
        });
        res.end(csv);
    }

}

function writeRouteData(id, query, extname, res) {
    var since = query.since || '-inf'
      , until = query.until || '+inf'
      ;
    redisClient.zrangebyscore(id, since, until, function(error, values) {
        var data = _.map(values, function(value) {
            return unCompressPathData(JSON.parse(value), pathKeys);
        });
        if (extname == '.csv') {
            respondInCsv(error, data, res);
        } else {
            respondInJson(error, data, query.callback, res);
        }
    });
}

function trafficData(req, res) {
    var trafficRouteId = req.params.trafficRoute
      , requestUrl = url.parse(req.url)
      , query = qs.parse(requestUrl.query)
      ;
    if (_.contains(trafficRouteId, '.')) {
        trafficRouteId = trafficRouteId.split('.').shift();
    }
    if (! req.params || ! req.params.trafficRoute) {
        res.status(404).send('Not found');
    } else if (req.params.trafficRoute == 'paths') {
        writeKeys(query, res);
    } else if (isInt(trafficRouteId)) {
        trafficRouteId = parseInt(req.params.trafficRoute);
        writeRouteData(trafficRouteId, query, path.extname(req.params.trafficRoute), res);
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
