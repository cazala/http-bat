"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// NODE
var util = require('util');
// NPM
var methods = require('methods');
exports.pointerLib = require('./Pointer');
var ATLAssertion_1 = require('./ATLAssertion');
var ATLRequest_1 = require('./ATLRequest');
var YAML_1 = require('./YAML');
/// ---
var CanceledError = (function (_super) {
    __extends(CanceledError, _super);
    function CanceledError() {
        _super.call(this, 'CANCELED');
    }
    CanceledError.prototype.inspect = function () {
        return 'CANCELED';
    };
    return CanceledError;
}(Error));
exports.CanceledError = CanceledError;
/// ---
var ATLSuite = (function () {
    function ATLSuite(name) {
        this.name = name;
        this.dependsOn = [];
        this.suites = null;
        this.async = false;
        this.descriptor = null;
        this.test = null;
        this.skip = false;
        this.flatPromise = flatPromise();
        this.promise = this.flatPromise.promise;
    }
    ATLSuite.prototype.run = function () {
        var _this = this;
        var mutex = this.dependsOn.length ? Promise.all(this.dependsOn.map(function (x) { return x.promise; })) : Promise.resolve();
        mutex.then(function () {
            if (_this.test) {
                var innerRun = _this.test.run();
                innerRun.then(function () { return _this.flatPromise.resolver(); });
                innerRun.catch(function (err) { return _this.reject(err); });
            }
            else if (_this.suites) {
                if (!_this.suites.length) {
                    _this.flatPromise.resolver();
                }
                else {
                    var innerMutex = Promise.all(_this.suites.map(function (x) { return x.run(); }));
                    innerMutex.then(function () { return _this.flatPromise.resolver(); });
                    innerMutex.catch(function (err) {
                        _this.reject(err);
                    });
                }
            }
            else
                _this.flatPromise.rejecter(new Error('Invalid suite. No tests and no sub suites found. ' + _this.name));
        });
        mutex.catch(function (err) {
            _this.reject(err);
        });
        return this.promise;
    };
    ATLSuite.prototype.reject = function (error) {
        if (this.skip && error instanceof Error) {
            this.flatPromise.resolver();
        }
        else {
            this.flatPromise.rejecter(error);
        }
        this.cancel(error);
    };
    ATLSuite.prototype.cancel = function (err) {
        this.flatPromise.rejecter(err);
        if (this.test)
            this.test.cancel(err);
        if (this.suites && this.suites.length)
            this.suites.forEach(function (x) { return x.cancel(err); });
    };
    return ATLSuite;
}());
exports.ATLSuite = ATLSuite;
var ATLTest = (function () {
    function ATLTest() {
        var _this = this;
        this.skip = false;
        this.timeout = 30000;
        this.response = {};
        this.request = {};
        this.flatPromise = flatPromise();
        this.promise = this.flatPromise.promise;
        this.requester = new ATLRequest_1.ATLRequest(this);
        this.assertions = [];
        this.requester.promise
            .catch(function (x) { return _this.flatPromise.rejecter(x); });
    }
    ATLTest.prototype.run = function () {
        var _this = this;
        if (this.skip) {
            this.flatPromise.resolver();
            return this.promise;
        }
        if (!this.assertions.length) {
            this.requester.promise
                .then(function (x) { return _this.flatPromise.resolver(); });
        }
        else {
            var assertionResults = Promise.all(this.assertions.map(function (x) { return x.promise; }));
            assertionResults
                .then(function (assertionResults) {
                var errors = assertionResults.filter(function (x) { return !!x; });
                if (errors.length) {
                    _this.flatPromise.rejecter(errors);
                }
                else {
                    _this.flatPromise.resolver();
                }
            });
            assertionResults
                .catch(function (errors) {
                _this.flatPromise.rejecter(errors);
            });
        }
        this.requester.run();
        return this.promise;
    };
    ATLTest.prototype.cancel = function (err) {
        try {
            this.flatPromise.rejecter(err);
        }
        catch (e) {
        }
        this.assertions.forEach(function (x) {
            try {
                x.cancel();
            }
            catch (e) { }
        });
        try {
            this.requester.cancel();
        }
        catch (e) { }
    };
    return ATLTest;
}());
exports.ATLTest = ATLTest;
/// ---
var interpreteSuite = {
    skip: function (suite, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            var skip = YAML_1.YAMLAstHelpers.readScalar(node);
            suite.skip = !!skip;
        }
    },
    async: function (suite, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            var async = YAML_1.YAMLAstHelpers.readScalar(node);
            suite.async = !!async;
        }
    },
    UNKNOWN: function (suite, node, name) {
        var method = parseMethodHeader(name);
        if (method) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                if (suite.suites.some(function (x) { return x.name == name; })) {
                    throw new YAML_1.NodeError('Duplicated test name: ' + name, node);
                }
                var testSuite = new ATLSuite(name);
                testSuite.atl = suite.atl;
                testSuite.descriptor = YAML_1.YAMLAstHelpers.toObject(node);
                testSuite.test = parseTest(node, suite);
                testSuite.skip = testSuite.test.skip;
                testSuite.test.method = method.method;
                testSuite.test.uri = method.url;
                if (suite.lastSuite)
                    testSuite.dependsOn.push(suite.lastSuite);
                suite.lastSuite = testSuite;
                if (!suite.firstSuite)
                    suite.firstSuite = testSuite;
                suite.suites.push(testSuite);
            }
        }
        else {
            throw new YAML_1.NodeError('Invalid node: ' + name, node);
        }
    }
};
var interpreteTest = {
    uriParameters: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            test.uriParameters = {};
            var object_1 = YAML_1.YAMLAstHelpers.getMap(node);
            var keys = Object.keys(object_1);
            keys.forEach(function (key) {
                var val = YAML_1.YAMLAstHelpers.readScalar(object_1[key]) || object_1[key];
                ensureInstanceOf("uriParameters." + key, val, Number, String, exports.pointerLib.Pointer);
                test.uriParameters[key] = val;
            });
        }
    },
    description: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            var description = YAML_1.YAMLAstHelpers.readScalar(node);
            ensureInstanceOf("description", description, String);
            if (description.trim().length > 0) {
                test.description = description;
            }
        }
    },
    id: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String, Number)) {
            var id = YAML_1.YAMLAstHelpers.readScalar(node);
            test.testId = id.toString();
        }
    },
    timeout: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Number)) {
            var value = YAML_1.YAMLAstHelpers.readScalar(node);
            ensureInstanceOf("timeout", value, Number);
            if (value <= 0)
                throw new YAML_1.NodeError("timeout must be a number > 0", node);
            test.timeout = value;
        }
    },
    queryParameters: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            test.request.queryParameters = test.request.queryParameters || {};
            var object_2 = YAML_1.YAMLAstHelpers.getMap(node);
            var keys = Object.keys(object_2);
            keys.forEach(function (key) {
                var val = YAML_1.YAMLAstHelpers.readScalar(object_2[key]) || object_2[key];
                ensureInstanceOf("queryParameters." + key, val, Number, String, Boolean, exports.pointerLib.Pointer);
                test.request.queryParameters[key] = val;
            });
        }
    },
    headers: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            var object_3 = YAML_1.YAMLAstHelpers.getMap(node);
            var keys = Object.keys(object_3);
            keys.forEach(function (key) {
                var val = YAML_1.YAMLAstHelpers.readScalar(object_3[key]) || object_3[key];
                ensureInstanceOf("headers." + key, val, String, exports.pointerLib.Pointer);
                test.request.headers[key.toLowerCase()] = val;
            });
        }
    },
    request: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            parseRequest(test, node);
        }
    },
    response: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            parseResponse(test, node);
        }
    },
    skip: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            var id = YAML_1.YAMLAstHelpers.readScalar(node);
            test.skip = !!id;
            if (test.skip) {
                test.requester.cancel();
            }
        }
    }
};
function parseSuites(sequenceName, node, instance) {
    var suite = new ATLSuite(sequenceName);
    suite.atl = instance;
    suite.suites = [];
    YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteSuite, false, suite);
    if (suite.skip) {
        // skips all the inner suites and tests
        var recursiveSkip_1 = function (suite) {
            suite.skip = true;
            suite.suites && suite.suites.forEach(recursiveSkip_1);
            suite.test && (suite.test.skip = true);
        };
        recursiveSkip_1(suite);
    }
    return suite;
}
exports.parseSuites = parseSuites;
function parseTest(node, suite) {
    var test = new ATLTest;
    test.suite = suite;
    test.lowLevelNode = node;
    test.request.headers = test.request.headers || {};
    YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteTest, true, suite, test);
    if (!test.response || !test.response.status) {
        test.response.status = 200;
    }
    generateTestAssertions(test);
    return test;
}
exports.parseTest = parseTest;
var interpreteRequest = {
    json: function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.toObject(node);
        test.request.json = value;
    },
    attach: function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        test.request.attach = [];
        value.forEach(function (kvo) {
            if (typeof kvo.value != "string")
                new YAML_1.NodeError("request.attach.* must be a path", node);
            else
                test.request.attach.push(kvo);
        });
    },
    form: function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        if (!('content-type' in test.request.headers)) {
            test.request.headers['content-type'] = "multipart/form-data";
        }
        else {
            new YAML_1.NodeError("you CAN'T use content-type AND form fields", node);
            return;
        }
        test.request.form = value;
    },
    urlencoded: function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        if (!('content-type' in test.request.headers)) {
            test.request.headers['content-type'] = "application/x-www-form-urlencoded";
        }
        else {
            new YAML_1.NodeError("you CAN'T use content-type AND urlencoded form", node);
        }
        test.request.urlencoded = value;
    }
};
var interpreteResponse = (_a = {
        headers: function (suite, test, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var value_1 = YAML_1.YAMLAstHelpers.toObject(node);
                test.response.headers = {};
                var keys = Object.keys(value_1);
                keys.forEach(function (key) {
                    var val = value_1[key];
                    ensureInstanceOf("response.headers." + key, val, String, exports.pointerLib.Pointer);
                    test.response.headers[key.toLowerCase()] = val;
                });
            }
        }
    },
    _a['content-type'] = function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            var value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.headers = test.response.headers || {};
            if ('content-type' in test.response.headers) {
                new YAML_1.NodeError("response.content-type alredy registered as request.header.content-type You can not use BOTH", node);
                return;
            }
            test.response.headers['content-type'] = value;
        }
    },
    _a.status = function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Number)) {
            var value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.status = parseInt(value) | 0;
        }
    },
    _a.print = function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            var value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.print = !!value;
        }
    },
    _a.body = function (suite, test, node) {
        parseResponseBody(test, node);
    },
    _a
);
var interpreteResponseBody = (_b = {},
    _b['is'] = function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.toObject(node);
        test.response.body.is = value;
    },
    _b.matches = function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        test.response.body.matches = value;
    },
    _b.schema = function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            var value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.body.schema = value;
        }
    },
    _b.take = function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.isSeq(node)) {
            var value = YAML_1.YAMLAstHelpers.readKVOElems(node);
            test.response.body.take = [];
            value.forEach(function (takenElement) {
                if (!(takenElement.value instanceof exports.pointerLib.Pointer))
                    node.errors.push(new YAML_1.NodeError("response.body.take.* must be a pointer ex: !!variable myValue", node));
                else
                    test.response.body.take.push(takenElement);
            });
        }
        else {
            /* istanbul ignore else */
            var value = YAML_1.YAMLAstHelpers.toObject(node);
            if (value instanceof exports.pointerLib.Pointer) {
                test.response.body.copyTo = value;
            }
            else {
                new YAML_1.NodeError("response.body.take must be a sequence of pointers or a !!variable", node);
            }
        }
    },
    _b.print = function (suite, test, node) {
        var value = YAML_1.YAMLAstHelpers.readScalar(node);
        ensureInstanceOf("response.body.print", value, Boolean);
        test.response.body.print = value;
    },
    _b
);
function parseRequest(test, node) {
    test.request.lowLevelNode = node;
    if (YAML_1.YAMLAstHelpers.isMap(node)) {
        YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteRequest, true, test.suite, test);
    }
    else {
        new YAML_1.NodeError("request must be a map", node);
    }
}
function parseResponse(test, node) {
    test.response.lowLevelNode = node;
    if (YAML_1.YAMLAstHelpers.isMap(node)) {
        YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteResponse, true, test.suite, test);
    }
    else {
        new YAML_1.NodeError("response must be a map", node);
    }
}
function parseResponseBody(test, responseBody) {
    test.response.body = {};
    test.response.body.lowLevelNode = responseBody;
    if (YAML_1.YAMLAstHelpers.isMap(responseBody)) {
        YAML_1.YAMLAstHelpers.iterpretMap(responseBody, interpreteResponseBody, true, test.suite, test);
    }
    else {
        new YAML_1.NodeError("response.body must be a map", responseBody);
    }
}
function ensureInstanceOf(name, value) {
    var types = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        types[_i - 2] = arguments[_i];
    }
    for (var i = 0; i < types.length; i++) {
        if (typeof types[i] == "function") {
            if (types[i] === Object && typeof value != "object")
                continue;
            if (typeof value != "undefined") {
                if (types[i] === Number && typeof value == "number")
                    if (isNaN(value))
                        continue;
                    else
                        return;
                if (types[i] === String && typeof value === 'string')
                    return;
                if (types[i] === Boolean && typeof value === 'boolean')
                    return;
                if (value instanceof types[i])
                    return;
            }
        }
    }
    throw new TypeError(name + " must be instance of " + types.map(function (x) { return x && x.displayName || x && x.name || x.toString(); }).join(" | ") + " got " + util.inspect(value));
}
exports.ensureInstanceOf = ensureInstanceOf;
function parseMethodHeader(name) {
    var parts = name.split(/\s+/g);
    var method = null;
    method = parts[0].trim().toLowerCase();
    if (method.length == 0)
        return null;
    // methods should have 2 parts
    if (parts.length != 2)
        return null;
    if (parts[0] != parts[0].toUpperCase())
        return null;
    if (methods.indexOf(method) == -1)
        throw new TypeError("ERROR: unknown method " + method + " on " + name);
    // if the URL doesn't starts with "/"
    if (parts[1].substr(0, 1) != '/' && parts[1].substr(0, 1) != '?')
        throw new Error("ERROR: the url must starts with '/' or '?': " + name);
    // if the URL ends with "/"
    if (parts[1].substr(-1) == '/' && parts[1].length > 1)
        throw new Error("ERROR: the url must not ends with '/': " + name);
    if (parts[1].indexOf('#') != -1)
        parts[1] = parts[1].substr(0, parts[1].indexOf('#'));
    return {
        method: method,
        url: parts[1]
    };
}
exports.parseMethodHeader = parseMethodHeader;
function cloneObjectUsingPointers(baseObject, store) {
    if (typeof baseObject !== "object") {
        return baseObject;
    }
    return cloneObject(baseObject, store);
}
exports.cloneObjectUsingPointers = cloneObjectUsingPointers;
function cloneObject(obj, store) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj == "string" || typeof obj == "number" || typeof obj == "boolean")
        return obj;
    // Handle Date (return new Date object with old value)
    if (obj instanceof Date) {
        return new Date(obj);
    }
    if (obj instanceof String || obj instanceof Number || obj instanceof Boolean) {
        return obj;
    }
    // Handle Array (return a full slice of the array)
    if (obj instanceof Array) {
        var newArray = obj.slice();
        return newArray.map(function (x) { return cloneObject(x, store); });
    }
    if (obj instanceof exports.pointerLib.Pointer) {
        var result = void 0;
        try {
            result = cloneObject(obj.get(store), store);
        }
        catch (e) {
            console.error("cloneObject::Error", e);
        }
        return result;
    }
    if (obj instanceof RegExp) {
        return obj;
    }
    // Handle Object
    if (obj instanceof Object) {
        var copy = new obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) {
                copy[attr] = cloneObject(obj[attr], store);
            }
        }
        return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported. " + util.inspect(obj));
}
function flatPromise() {
    var result = {
        resolver: null,
        rejecter: null,
        promise: null
    };
    result.promise = new Promise(function (a, b) {
        result.resolver = a;
        result.rejecter = function (x) {
            b(x);
            result.rejecter = function () { };
        };
    });
    return result;
}
exports.flatPromise = flatPromise;
function errorDiff(msg, expected, actual, ctx) {
    var err = new Error(msg);
    if (ctx) {
        err.message = null;
        err.inspect = function () {
            err.message = msg;
            return msg + "\n" + JSON.stringify(ctx, null, 2);
        };
    }
    err.expected = expected;
    err.actual = actual;
    err.showDiff = true;
    return err;
}
exports.errorDiff = errorDiff;
function error(msg, ctx) {
    var err = new Error(msg);
    if (ctx) {
        err.message = null;
        err.inspect = function () {
            err.message = msg;
            return msg + "\n" + JSON.stringify(ctx, null, 2);
        };
    }
    return err;
}
exports.error = error;
if (!(error('test', {}) instanceof Error))
    process.exit(1);
if (!(errorDiff('test', 1, 2, {}) instanceof Error))
    process.exit(1);
function generateTestAssertions(test) {
    if (test.suite.skip)
        return;
    if (test.response) {
        if (test.response.status) {
            test.assertions.push(new ATLAssertion_1.CommonAssertions.StatusCodeAssertion(test, test.response.status));
        }
        if (test.response.body) {
            if ('is' in test.response.body) {
                test.assertions.push(new ATLAssertion_1.CommonAssertions.BodyEqualsAssertion(test, test.response.body.is));
            }
            if (test.response.body.schema) {
                test.assertions.push(new ATLAssertion_1.CommonAssertions.ValidateSchemaOperation(test, test.response.body.schema));
            }
            if (test.response.body.matches) {
                test.response.body.matches.forEach(function (kvo) {
                    test.assertions.push(new ATLAssertion_1.CommonAssertions.BodyMatchesAssertion(test, kvo.key, kvo.value));
                });
            }
            if (test.response.headers) {
                for (var h in test.response.headers) {
                    test.assertions.push(new ATLAssertion_1.CommonAssertions.HeaderMatchesAssertion(test, h, test.response.headers[h]));
                }
            }
            if (test.response.body.take) {
                var take = test.response.body.take;
                take.forEach(function (takenElement) {
                    test.assertions.push(new ATLAssertion_1.CommonAssertions.CopyBodyValueOperation(test, takenElement.key, takenElement.value));
                });
            }
            if (test.response.body.copyTo && test.response.body.copyTo instanceof exports.pointerLib.Pointer) {
                test.assertions.push(new ATLAssertion_1.CommonAssertions.CopyBodyValueOperation(test, '*', test.response.body.copyTo));
            }
        }
    }
}
var _a, _b;
//# sourceMappingURL=ATLHelpers.js.map