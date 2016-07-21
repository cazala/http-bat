#!/usr/bin/env node
// NODE
import path = require('path');
import fs = require('fs');
import { dirname, resolve, join as joinPath } from 'path';
import _ = require('lodash');

// NPM
const glob = require('glob');
const Mocha = require('mocha');

// LOCALS
import { Bat } from '../lib/bat';
import YAML = require('../lib/YAML');
import { CoverageData, GlobalCoverageDataCollector } from '../lib/Coverage';
import httpBatMochaAdapter = require('../lib/adapters/mocha');
import { HTMLCov } from '../lib/RAMLCoverageReporter';

declare var describe, it;

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
let sharedCoverageData = new CoverageData;

foundFiles.forEach(function (file) {

  file = path.resolve(file);
  mocha.suite.emit('pre-require', global, file, mocha);

  mocha.suite.emit('require', (function (file, uri) {
    describe('Load ' + file, function () {
      let instance: Bat;

      this.bail(true);

      instance = new Bat({
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

let COVReport = HTMLCov(runner);

runner.on('end', function (failures) {
  let coverageFile = path.resolve(cwd, 'coverage/lcov.info');
  let keys = Object.keys(GlobalCoverageDataCollector.data);
  if (keys.length) {
    try {

      COVReport.write(path.resolve(cwd, 'coverage/raml.html'));
    } catch (e) {
      // console.log(e);
    }

    instances.forEach(function (x) { x.RAMLCoverage && x.RAMLCoverage.writeCoverage(coverageFile); });
  }

  if (failureCount)
    process.exit(failureCount);
});



