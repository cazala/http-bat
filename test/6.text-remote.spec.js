/// <reference path="typings/index.d.ts" />
"use strict";
const dist_1 = require('../dist');
const mocha_1 = require('../dist/adapters/mocha');
const glob = require('glob');
let foundFiles = glob.sync('valid-specs/**/*.remote.spec.yml', {
    nodir: true,
    cwd: __dirname,
    realpath: true,
    stat: true
});
foundFiles.forEach(file => {
    describe(file, () => {
        let instance = new dist_1.Bat();
        instance.load(file);
        mocha_1.registerMochaSuites(instance);
        instance.run();
    });
});
//# sourceMappingURL=6.text-remote.spec.js.map