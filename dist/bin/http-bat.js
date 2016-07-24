#!/usr/bin/env node
"use strict";
const path = require('path');
// NPM
const glob = require('glob');
const Mocha = require('mocha');
// LOCALS
const index_1 = require('../index');
const YAML = require('../lib/YAML');
const Coverage_1 = require('../lib/Coverage');
const httpBatMochaAdapter = require('../adapters/mocha');
const RAMLCoverageReporter_1 = require('../lib/RAMLCoverageReporter');
const pkg = require('../package.json');
let opts = require('yargs')
    .usage('http-bat test.yml [--uri uri] -- [mocha argv]')
    .version('version', pkg.version)
    .alias('u', 'uri')
    .describe('u', 'target Uri')
    .parse(process.argv);
let cwd = process.cwd();
let files = opts._[2];
let uri = opts.uri || "default";
if (uri) {
    console.info("http-bat: Default endpoint setted to " + uri);
}
if (!files) {
    files = '**/*.yml';
}
let mocha = new Mocha({
    bail: false,
    useColors: true
});
let foundFiles = glob.sync(files, {
    nodir: true,
    cwd: cwd,
    realpath: true,
    stat: true
});
if (!foundFiles.length) {
    console.error("http-bat: No file matching " + JSON.stringify(files));
    process.exit(1);
}
let instances = [];
let sharedCoverageData = new Coverage_1.CoverageData;
foundFiles.forEach(function (file) {
    file = path.resolve(file);
    mocha.suite.emit('pre-require', global, file, mocha);
    mocha.suite.emit('require', (function (file, uri) {
        describe('Load ' + file, function () {
            let instance;
            this.bail(true);
            instance = new index_1.Bat({
                baseUri: uri
            });
            instances.push(instance);
            it('Load file', function (done) {
                instance.load(file);
                if (instance.RAMLCoverage) {
                    instance.RAMLCoverage.coverageData = sharedCoverageData;
                }
                if (instance.errors && instance.errors.length) {
                    instance.errors.forEach(element => {
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
let runner = mocha.run();
let failureCount = 0;
let passCount = 0;
runner.on('pass', function () {
    ++passCount;
});
runner.on('fail', function () {
    ++failureCount;
});
let COVReport = RAMLCoverageReporter_1.HTMLCov(runner);
runner.on('end', function (failures) {
    let coverageFile = path.resolve(cwd, 'coverage/lcov.info');
    let keys = Object.keys(Coverage_1.GlobalCoverageDataCollector.data);
    if (keys.length) {
        try {
            COVReport.write(path.resolve(cwd, 'coverage/raml.html'));
        }
        catch (e) {
            console.log(e);
        }
        instances.forEach(function (x) { x.RAMLCoverage && x.RAMLCoverage.writeCoverage(coverageFile); });
    }
    if (failureCount)
        process.exit(failureCount);
});
//# sourceMappingURL=http-bat.js.map