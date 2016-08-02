"use strict";
var Runnable_1 = require('./../dist/lib/Runnable');
describe('Basic runs', function () {
    it('Promises must be handled by mocha', function () { return Promise.resolve(1); });
    it('Must pass without dependencies', function () {
        var r0 = new Runnable_1.Runnable(function () {
            return Promise.resolve(1);
        });
        r0.run();
        return r0;
    });
    var val = 0;
    var r0 = new Runnable_1.Runnable(function () {
        val++;
        return Promise.resolve(1);
    });
    it('It must not run till .run()', function () {
        if (val != 0)
            throw new Error(val.toString());
    });
    it('Must pass with dependencies', function () {
        var r1 = new Runnable_1.Runnable(function () {
            if (val == 0)
                return Promise.reject(1);
            return Promise.resolve(1);
        });
        r1.addDependency(r0);
        r1.run();
        return r1;
    });
    it('Must pass with dependencies already runned', function () {
        var r1 = new Runnable_1.Runnable(function () {
            if (val != 1)
                return Promise.reject(val);
            return Promise.resolve(1);
        });
        r1.addDependency(r0);
        r1.run();
        return r1;
    });
    it('should fail on cascade', function (done) {
        var val = 0;
        var r0 = new Runnable_1.Runnable(function () {
            val++;
            return Promise.resolve(1);
        });
        var r1 = new Runnable_1.Runnable(function () {
            val++;
            return Promise.reject(1);
        });
        r1.addDependency(r0);
        var r2 = new Runnable_1.Runnable(function () {
            val++;
            return Promise.resolve(1);
        });
        r2.addDependency(r1);
        r2.run();
        r2.catch(function (x) {
            if (val != 2)
                done(new Error(val.toString()));
            done();
        });
        r2.then(function (x) {
            done(new Error("it should have failed " + x));
        });
    });
});
//# sourceMappingURL=1.runnable.spec.js.map