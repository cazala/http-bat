#!/usr/bin/env node
"use strict";
var path = require('path');
// NPM
var glob = require('glob');
var Mocha = require('mocha');
// LOCALS
var bat_1 = require('../lib/bat');
var YAML = require('../lib/YAML');
var Coverage_1 = require('../lib/Coverage');
var httpBatMochaAdapter = require('../lib/adapters/mocha');
var RAMLCoverageReporter_1 = require('../lib/RAMLCoverageReporter');
var pkg = require('../package.json');
var opts = require('yargs')
    .usage('http-bat test.yml [--uri uri] -- [mocha argv]')
    .version('version', pkg.version)
    .alias('u', 'uri')
    .describe('u', 'target Uri')
    .parse(process.argv);
var cwd = process.cwd();
var files = opts._[2];
var uri = opts.uri || "default";
if (uri) {
    console.info("http-bat: Default endpoint setted to " + uri);
}
if (!files) {
    files = '**/*.yml';
}
var mocha = new Mocha({
    bail: false,
    useColors: true
});
var foundFiles = glob.sync(files, {
    nodir: true,
    cwd: cwd,
    realpath: true,
    stat: true
});
if (!foundFiles.length) {
    console.error("http-bat: No file matching " + JSON.stringify(files));
    process.exit(1);
}
var instances = [];
var sharedCoverageData = new Coverage_1.CoverageData;
foundFiles.forEach(function (file) {
    file = path.resolve(file);
    mocha.suite.emit('pre-require', global, file, mocha);
    mocha.suite.emit('require', (function (file, uri) {
        describe('Load ' + file, function () {
            var instance;
            this.bail(true);
            instance = new bat_1.Bat({
                baseUri: uri
            });
            instances.push(instance);
            it('Load file', function (done) {
                instance.load(file);
                if (instance.RAMLCoverage) {
                    instance.RAMLCoverage.coverageData = sharedCoverageData;
                }
                if (instance.errors && instance.errors.length) {
                    instance.errors.forEach(function (element) {
                        YAML.printError(element);
                    });
                    return done(new Error("Error while loading " + file));
                }
                httpBatMochaAdapter.registerMochaSuites(instance);
                instance.run();
                done();
            });
        });
    })(file, uri), file, mocha);
    mocha.suite.emit('post-require', global, file, mocha);
});
var runner = mocha.run();
var failureCount = 0;
var passCount = 0;
runner.on('pass', function () {
    ++passCount;
});
runner.on('fail', function () {
    ++failureCount;
});
var COVReport = RAMLCoverageReporter_1.HTMLCov(runner);
runner.on('end', function (failures) {
    var coverageFile = path.resolve(cwd, 'coverage/lcov.info');
    var keys = Object.keys(Coverage_1.GlobalCoverageDataCollector.data);
    if (keys.length) {
        try {
            COVReport.write(path.resolve(cwd, 'coverage/raml.html'));
        }
        catch (e) {
        }
        instances.forEach(function (x) { x.RAMLCoverage && x.RAMLCoverage.writeCoverage(coverageFile); });
    }
    if (failureCount)
        process.exit(failureCount);
});
//# sourceMappingURL=http-bat.js.map