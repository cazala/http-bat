/// <reference path="typings/index.d.ts" />
"use strict";
const dist_1 = require('../dist');
const glob = require('glob');
let foundFiles = glob.sync('invalid-specs/**/*.yml', {
    nodir: true,
    cwd: __dirname,
    realpath: true,
    stat: true
});
foundFiles.forEach(file => {
    describe(file, () => {
        it('must fail on parsing', (done) => {
            let instance = new dist_1.Bat();
            instance.load(file);
            if (instance.errors.length) {
                instance.errors.forEach(element => {
                    dist_1.YAML.printError(element);
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
foundFiles.forEach(file => {
    describe(file, () => {
        it('must parse without errors', (done) => {
            let instance = new dist_1.Bat();
            instance.load(file);
            if (instance.errors.length) {
                instance.errors.forEach(element => {
                    dist_1.YAML.printError(element);
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