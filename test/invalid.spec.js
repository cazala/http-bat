/// <reference path="../src/typings/index.d.ts" />
"use strict";
var dist_1 = require('../dist');
var YAML = require('../dist/lib/YAML');
var glob = require('glob');
var foundFiles = glob.sync('invalid-specs/**/*.yml', {
    nodir: true,
    cwd: __dirname,
    realpath: true,
    stat: true
});
foundFiles.forEach(function (file) {
    describe(file, function () {
        it('must fail on parsing', function (done) {
            var instance = new dist_1.Bat();
            instance.load(file);
            if (instance.errors.length) {
                instance.errors.forEach(function (element) {
                    YAML.printError(element);
                });
                done();
            }
            else {
                done(new Error('MUST FAIL ON PARSING'));
            }
        });
    });
});
foundFiles = glob.sync('valid-specs/**/*.spec.yml', {
    nodir: true,
    cwd: __dirname,
    realpath: true,
    stat: true
});
foundFiles.forEach(function (file) {
    describe(file, function () {
        it('must parse without errors', function (done) {
            var instance = new dist_1.Bat();
            instance.load(file);
            if (instance.errors.length) {
                instance.errors.forEach(function (element) {
                    YAML.printError(element);
                });
                done(instance.errors[0]);
            }
            else {
                done();
            }
        });
    });
});
//# sourceMappingURL=invalid.spec.js.map