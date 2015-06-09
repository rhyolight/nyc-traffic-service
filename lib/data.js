var url = require('url')
  , path = require('path')
  , qs = require('querystring')
  , _ = require('lodash')
  , async = require('async')
  , redis = require('redis')

  , jsonUtils = require('./json')

  , redisUrl = process.env.REDIS_URL
  , redisClient

  , pathKeys = require('./config').pathKeys
  , csvKeys = ['DataAsOf', 'Speed', 'TravelTime']
  , detailKeys = ['Borough', 'linkName', 'linkPoints']
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

function fetchDetails(ids, callback) {
    var fetchers = {};
    _.each(ids, function(id) {
        fetchers[id] = function(localCallback) {
            redisClient.zrangebyscore([
                id, '-inf', '+inf', 'WITHSCORES', 'LIMIT', 0, 1
            ], function(err, data) {
                if (err) return localCallback(err);
                localCallback(null, JSON.parse(data[0]));
            });
        };
    });
    async.parallel(fetchers, callback);
}

function detailDataToKeyedObject(data) {
    var out = {};
    _.each(pathKeys, function(key, index) {
        if (_.contains(detailKeys, key)) {
            out[key] = data[index];
        }
    });
    return out;
};

function writeKeys(query, res) {
    redisClient.keys('*', function(error, keys) {
        var intKeys
          , whenDone;
        if (error) {
            jsonUtils.renderErrors([error], res, query.callback);
        } else {
            intKeys = _.map(keys, function(id) {
                return parseInt(id);
            }).sort(function(a, b) { return a - b;});

            whenDone = function(err, details) {
                var dataOut;
                if (err) {
                    return res.status(404).send(err.message);
                }
                dataOut = {
                    paths: intKeys
                  , count: intKeys.length
                }
                if (details) {
                    dataOut.paths = {};
                    _.each(_.keys(details), function(id) {
                        dataOut.paths[id]
                            = detailDataToKeyedObject(details[id]);
                    });
                }
                jsonUtils.render(dataOut, res, query.callback);
            };

            if (query.includeDetails) {
                fetchDetails(intKeys, whenDone);
            } else {
                whenDone();
            }

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
    var csv = '';
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
