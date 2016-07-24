"use strict";
const Interpolation = require('./../dist/lib/Interpolation');
const MustFullfilInterpolation = (text, store, expected) => {
    it("Must fullfill interpolation " + text, function () {
        let r = Interpolation.interpolateString(text, store);
        let error;
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
const MustPartiallyFullfillInterpolation = (text, store, expected) => {
    it("Must partially fullfill interpolation " + text, function () {
        let r = Interpolation.interpolateString(text, store);
        if (expected != r) {
            let r = new Error("Failed on string interpolation");
            r.actual = r;
            r.expected = expected;
            throw r;
        }
    });
};
describe("Url interpolation", () => {
    it("must not parse anything", () => {
        Interpolation.ensureAllInterpolations("/url");
        Interpolation.ensureAllInterpolations(`/url/\\{test}/teta`);
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