"use strict";
var ATLSuite = (function () {
    function ATLSuite(name) {
        this.name = name;
        this.suites = null;
        this.async = false;
        this.descriptor = null;
        this.test = null;
        this.skip = false;
        this.soft = false;
    }
    return ATLSuite;
}());
exports.ATLSuite = ATLSuite;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ATLSuite;
//# sourceMappingURL=ATLSuite.js.map