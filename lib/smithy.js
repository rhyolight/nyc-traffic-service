var path = require('path')
  , fs = require('fs-extra')
  , _ = require('lodash')
  , Metalsmith = require('metalsmith')
  , templates = require('metalsmith-templates')
  , markdown = require('metalsmith-markdown')
  , permalinks = require('metalsmith-permalinks')
  , date = require('metalsmith-build-date')
  , config = require('./config')

  , source = '../site'
  , destination = '../build'
  , bowerDist = 'bower_components/bootstrap/dist/'
  , jqueryDist = 'bower_components/jquery/dist/'
  , lodashDist = 'bower_components/lodash/'
  , asyncDist = 'bower_components/async/lib/'
  , siteDir = path.join(__dirname, source)
  , buildDir = path.join(__dirname, destination)
  ;

module.exports = function() {
    var baseurl = config.host;
    if (config.port && _.contains(config.host, 'localhost')) {
        baseurl += ':' + config.port;
    }
    // Ensure clean build.
    fs.removeSync(buildDir);
    Metalsmith(__dirname)
        .source(source)
        .destination(destination)
        .use(date())
        .use(function(files, metalsmith, done) {
            // This automatically updates the index page of the static site with
            // the contents of the README.
            var readmeContents 
                    = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf-8')
              , indexContents = files['index.md'].contents.toString('utf-8')
              , newContents = indexContents.replace(
                                  '{README_INSERTED_HERE}', readmeContents
                              )
              ;
            files['index.md'].contents = new Buffer(newContents);
            done();
        })
        .use(markdown())
        .use(templates({
            engine: 'handlebars'
          , directory: path.join(siteDir, 'layouts')
          , partials: {
                header: 'partials/header'
              , footer: 'partials/footer'
          }
          , baseurl: baseurl
        }))
        .use(permalinks({relative: false}))
        .use(function() {
            return function(files, metalsmith, done) {
                // Copies bootstrap components to /.
                _.each(files, function(details, name) {
                    var newPath;
                    if (_.contains(name, bowerDist)) {
                        newPath = name.replace(bowerDist, '');
                        files[newPath] = details;
                    } else if (_.contains(name, jqueryDist)) {
                        newPath = name.replace(jqueryDist, '');
                        files[newPath] = details;
                    } else if (_.contains(name, lodashDist)) {
                        newPath = name.replace(lodashDist, '');
                        files[newPath] = details;
                    } else if (_.contains(name, asyncDist)) {
                        newPath = name.replace(asyncDist, '');
                        files[newPath] = details;
                    }
                });
                done();
            };
        }())
        .build(function(error) {
            if (error) {
                console.error(error);
                process.exit(-1);
            }
        });
};
