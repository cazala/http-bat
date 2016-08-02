/// <reference path="typings/index.d.ts" />
"use strict";
var dist_1 = require('../dist');
var mocha_1 = require('../dist/adapters/mocha');
var glob = require('glob');
var foundFiles = glob.sync('valid-specs/**/*.remote.spec.yml', {
    nodir: true,
    cwd: __dirname,
    realpath: true,
    stat: true
});
foundFiles.forEach(function (file) {
    describe(file, function () {
        var instance = new dist_1.Bat();
        instance.load(file);
        var runner = instance.run();
        mocha_1.registerMochaSuites(runner, instance);
    });
});
//# sourceMappingURL=6.text-remote.spec.js.map