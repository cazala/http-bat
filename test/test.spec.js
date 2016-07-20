"use strict";
var app = require('./server');
var bat_1 = require('../lib/bat');
var util = require('util');
var instance = new bat_1.Bat({
    file: __dirname + '/valid-specs/test-1.spec.yml'
});
describe('HTTP CALLS', function () {
    var promiseColor = function (prom) {
        var res = util.inspect(prom);
        if (res == 'Promise { <pending> }') {
            return "\x1b[35m";
        }
        if (res.indexOf('Promise { <rejec') == 0) {
            var isCanceled = res.indexOf('CANCELED') != -1;
            return isCanceled ? "\x1b[34m" : "\x1b[31m";
        }
        return "\x1b[32m";
    };
    var printPromise = function (prom) {
        var color = promiseColor(prom);
        var res = util.inspect(prom);
        if (res == 'Promise { <pending> }') {
            return promiseColor(prom) + "PENDING \x1b[0m";
        }
        if (res.indexOf('Promise { <rejec') == 0) {
            var isCanceled = res.indexOf('CANCELED') != -1;
            return promiseColor(prom) + (isCanceled ? 'CANCELED' : 'REJECTED') + " \x1b[0m";
        }
        return promiseColor(prom) + "RESOLVED \x1b[0m";
    };
    var printPromises = function (suite, p) {
        p += promiseColor(suite.promise);
        console.log(p);
        console.log(p + suite.name, printPromise(suite.promise) + (suite.skip ? ' [SKIPPED]' : ''));
        p += "┃\x1b[0m";
        if (suite.test) {
            var head = p + '  ' + promiseColor(suite.test.promise) + '┃\x1b[0m';
            console.log(p + promiseColor(suite.test.promise) + '  TEST: ' + (suite.test.skip ? ' [SKIPPED]' : ''), suite.test.promise);
            console.log(head + promiseColor(suite.test.requester.promise) + '  REQUEST:', printPromise(suite.test.requester.promise));
            var head1_1 = head + '  ' + promiseColor(suite.test.requester.promise) + '┃\x1b[0m';
            suite.test.assertions.forEach(function (ass) {
                console.log(head1_1 + '  ' + printPromise(ass.promise) + ' ' + ass.name);
            });
            suite.test.assertions.length && console.log(head1_1 + '____');
            suite.test.assertions.length && console.log(head + '____');
        }
        if (suite.suites) {
            Object.keys(suite.suites).forEach(function (key) {
                printPromises(suite.suites[key], p + '  ');
            });
        }
        console.log(p + '____');
    };
    var printAll = function () {
        console.log(new Array(200).join('@') + '\x1B[2J\x1B[0f');
        Object
            .keys(instance.atl.suites)
            .map(function (key) {
            return printPromises(instance.atl.suites[key], '  ');
        });
    };
    var suiteHandler = function (suite) {
        describe(suite.name, function () {
            it(suite.async ? 'is ASYNC' : 'is SYNC');
            describe('depends on', function () {
                suite.dependsOn.forEach(function (dep) {
                    it(dep.name, function (done) {
                        dep.promise.then(function () { done(); });
                        dep.promise.catch(function (err) { done(err); });
                    });
                });
            });
            suite.suites && suite.suites.forEach(suiteHandler);
            suite.skip && it('is skipped');
            if (suite.test && !suite.skip) {
                it('is a test', function (done) {
                    suite.test.promise.then(function () { done(); });
                    suite.test.promise.catch(function (err) { done(err); });
                });
            }
            it('must pass', function (done) {
                suite.promise.then(function () { done(); });
                suite.promise.catch(function (err) { done(err); });
            });
        });
    };
    printAll();
    Object
        .keys(instance.atl.suites)
        .map(function (key) { return instance.atl.suites[key]; })
        .forEach(suiteHandler);
    var registerMochaSuites = require('../lib/adapters/mocha').registerMochaSuites;
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
//# sourceMappingURL=test.spec.js.map