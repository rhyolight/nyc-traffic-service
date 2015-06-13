var url = require('url')
  , path = require('path')
  , qs = require('querystring')
  , _ = require('lodash')
  , async = require('async')
  , redis = require('redis')

  , jsonUtils = require('./json')

  , redisUrl = process.env.REDIS_URL
  , redisClient

  , allPathKeys = require('./config').allPathKeys
  , staticPathKeys = require('./config').staticPathKeys
  , pathKeys = _.difference(allPathKeys, staticPathKeys)

  , csvKeys = ['DataAsOf', 'Speed', 'TravelTime']
  , detailKeys = ['Borough', 'linkName', 'linkPoints']
  ;

function isInt(value) {
    return ! isNaN(value)
        && parseInt(Number(value)) == value
        && ! isNaN(parseInt(value, 10));
}

function normalizeData(data) {
    var out = {};
    if (data.length == pathKeys.length) {
        _.each(pathKeys, function(key, i) {
            out[key] = data[i];
        });
    } else {
        // TODO: Remove this legacy code after all old data moves out of window.
        _.each(['Speed', 'TravelTime'], function(key, i) {
            out[key] = data[i + 1];
        });
    }
    out.DataAsOf = new Date(data.timestamp * 1000);
    return out;
}

function fetchDetails(ids, callback) {
    var fetchers = {};
    _.each(ids, function(id) {
        fetchers[id] = function(localCallback) {
            redisClient.hgetall('routeProps:' + id, localCallback);
        };
    });
    async.parallel(fetchers, callback);
}

function fetchKeys(includeDetails, callback) {
    redisClient.keys('[0-9]*', function(error, keys) {
        if (error) return callback(error);
        if (includeDetails) {
            fetchDetails(keys, callback);
        } else {
            callback(null, _.map(keys, function(k) { return parseInt(k); }));
        }
    });
}

function renderKeys(query, res) {
    fetchKeys(query.includeDetails, function(err, keys) {
        if (err) {
            return res.status(404).send(err.message);
        }
        dataOut = {
            paths: keys
          , count: _.size(keys)
        }
        jsonUtils.render(dataOut, res, query.callback);
    });
}

function respondInJson(error, data, props, callback, res) {
    if (error) {
        jsonUtils.renderErrors([error], res, query.callback);
    } else if (! data.length) {
        res.status(404).send('Not found');
    } else {
        jsonUtils.render({
            path: data
          , properties: props
          , count: data.length
        }, res, callback);
    }
}

function respondInCsv(error, data, props, res) {
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

function unzipScores(redisData) {
    var out = [];
    _.each(redisData, function(data, index) {
        if (index % 2 != 0) {
            out[out.length - 1].timestamp = parseInt(data);
        } else {
            out.push(JSON.parse(data));
        }
    });
    return out;
}

function renderRouteData(id, query, extname, res) {
    var since = query.since || '-inf'
      , until = query.until || '+inf'
      , limit = query.limit
      , fetchArgs = [id, since, until, 'WITHSCORES']
      ;
    if (limit) {
        fetchArgs = fetchArgs.concat(['LIMIT', 0, parseInt(limit)])
    }
    redisClient.hgetall('routeProps:' + id, function(keyError, props) {
        // TODO: handle this keyError.
        redisClient.zrangebyscore(fetchArgs, function(error, values) {
            var data = unzipScores(values);
            data = _.map(data, normalizeData);
            if (extname == '.csv') {
                respondInCsv(error, data, props, res);
            } else {
                respondInJson(error, data, props, query.callback, res);
            }
        });
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
        renderKeys(query, res);
    } else if (isInt(trafficRouteId)) {
        trafficRouteId = parseInt(req.params.trafficRoute);
        renderRouteData(trafficRouteId, query, path.extname(req.params.trafficRoute), res);
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
