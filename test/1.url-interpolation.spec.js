"use strict";
var Interpolation = require('./../dist/lib/Interpolation');
var MustFullfilInterpolation = function (text, store, expected) {
    it("Must fullfill interpolation " + text, function () {
        var r = Interpolation.interpolateString(text, store);
        var error;
        try {
            Interpolation.ensureAllInterpolations(r);
        }
        catch (e) {
            error = e;
        }
        if (expected != r) {
            error = new Error("Failed on string interpolation");
        }
        if (error) {
            error.actual = r;
            error.expected = expected;
            throw error;
        }
    });
};
var MustPartiallyFullfillInterpolation = function (text, store, expected) {
    it("Must partially fullfill interpolation " + text, function () {
        var r = Interpolation.interpolateString(text, store);
        if (expected != r) {
            var r_1 = new Error("Failed on string interpolation");
            r_1.actual = r_1;
            r_1.expected = expected;
            throw r_1;
        }
    });
};
describe("Url interpolation", function () {
    it("must not parse anything", function () {
        Interpolation.ensureAllInterpolations("/url");
        Interpolation.ensureAllInterpolations("/url/\\{test}/teta");
    });
    MustFullfilInterpolation("{a}", { a: "1" }, "1");
    MustFullfilInterpolation("{a}", { a: true }, "true");
    MustFullfilInterpolation("\\{a}", { a: "true" }, "\\{a}");
    MustFullfilInterpolation("/{controller}", { controller: ":" }, "/:");
    MustFullfilInterpolation("a/{controller}/{controller}teta", { controller: ":" }, "a/:/:teta");
    MustFullfilInterpolation("a/{controller}}/{controller}teta", { controller: ":" }, "a/:}/:teta");
    MustPartiallyFullfillInterpolation("{a} {b}", { a: "asd" }, "asd {b}");
});
//# sourceMappingURL=1.url-interpolation.spec.js.map