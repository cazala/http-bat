const app = require('./server');
import {Bat} from '../lib/bat';
import ATLHelpers = require('../lib/ATLHelpers');
import util = require('util');


const instance = new Bat({
  file: __dirname + '/valid-specs/test-1.spec.yml'
});

declare var describe, it;

describe('HTTP CALLS', function () {

  const promiseColor = prom => {
    let res = util.inspect(prom);

    if (res == 'Promise { <pending> }') {
      return "\x1b[35m";
    }
    if (res.indexOf('Promise { <rejec') == 0) {

      let isCanceled = res.indexOf('CANCELED') != -1;

      return isCanceled ? "\x1b[34m" : "\x1b[31m";
    }

    return "\x1b[32m";
  };

  const printPromise = prom => {
    let color = promiseColor(prom);
    let res = util.inspect(prom);

    if (res == 'Promise { <pending> }') {
      return promiseColor(prom) + "PENDING \x1b[0m";
    }

    if (res.indexOf('Promise { <rejec') == 0) {

      let isCanceled = res.indexOf('CANCELED') != -1;

      return promiseColor(prom) + (isCanceled ? 'CANCELED' : 'REJECTED') + " \x1b[0m";
    }

    return promiseColor(prom) + "RESOLVED \x1b[0m";
  };

  const printPromises = (suite: ATLHelpers.ATLSuite, p: string) => {

    p += promiseColor(suite.promise);

    console.log(p);
    console.log(p + suite.name, printPromise(suite.promise) + (suite.skip ? ' [SKIPPED]' : ''));

    p += "┃\x1b[0m";

    if (suite.test) {
      let head = p + '  ' + promiseColor(suite.test.promise) + '┃\x1b[0m';

      console.log(p + promiseColor(suite.test.promise) + '  TEST: ' + (suite.test.skip ? ' [SKIPPED]' : ''), suite.test.promise);
      console.log(head + promiseColor(suite.test.requester.promise) + '  REQUEST:', printPromise(suite.test.requester.promise));

      let head1 = head + '  ' + promiseColor(suite.test.requester.promise) + '┃\x1b[0m';
      suite.test.assertions.forEach(ass => {
        console.log(head1 + '  ' + printPromise(ass.promise) + ' ' + ass.name);
      });
      suite.test.assertions.length && console.log(head1 + '____');
      suite.test.assertions.length && console.log(head + '____');

    }

    if (suite.suites) {
      Object.keys(suite.suites).forEach(key => {
        printPromises(suite.suites[key], p + '  ');
      });
    }

    console.log(p + '____');
  };

  const printAll = () => {
    console.log(new Array(200).join('@') + '\x1B[2J\x1B[0f');
    Object
      .keys(instance.atl.suites)
      .map(key =>
        printPromises(instance.atl.suites[key], '  '));
  };

  const suiteHandler = (suite: ATLHelpers.ATLSuite) => {
    describe(suite.name, function () {
      it(suite.async ? 'is ASYNC' : 'is SYNC');

      describe('depends on', () => {
        suite.dependsOn.forEach(dep => {
          it(dep.name, (done) => {
            dep.promise.then(() => { done(); });
            dep.promise.catch(err => { done(err); });
          });
        });

      });

      suite.suites && suite.suites.forEach(suiteHandler);

      suite.skip && it('is skipped');

      if (suite.test && !suite.skip) {
        it('is a test', function (done) {
          suite.test.promise.then(() => { done(); });
          suite.test.promise.catch(err => { done(err); });
        });
      }

      it('must pass', function (done) {
        suite.promise.then(() => { done(); });
        suite.promise.catch(err => { done(err); });
      });
    });
  };

  printAll();

  Object
    .keys(instance.atl.suites)
    .map(key => instance.atl.suites[key])
    .forEach(suiteHandler);


  let registerMochaSuites = require('../lib/adapters/mocha').registerMochaSuites;
  registerMochaSuites(instance);

  instance.run(app)
    .then(function (error) {
      console.error(error);
      printAll();
    })
    .catch(function (error) {
      console.error(error);
      printAll();
    });
});

/*after(function () {
  instance.writeCoverage('../coverage/lcov.info');
});*/