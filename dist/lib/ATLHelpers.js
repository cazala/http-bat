"use strict";
// NODE
var util = require('util');
// NPM
var methods = require('methods');
exports.pointerLib = require('./Pointer');
var FileSystem_1 = require('./FileSystem');
var YAML_1 = require('./YAML');
var Exceptions_1 = require('./Exceptions');
var ATLTest_1 = require('./ATLTest');
var ATLSuite_1 = require('./ATLSuite');
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
    soft: function (suite, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            suite.soft = !!YAML_1.YAMLAstHelpers.readScalar(node);
        }
    },
    UNKNOWN: function (suite, node, name) {
        var method = parseMethodHeader(name);
        if (method) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                if (suite.suites.some(function (x) { return x.name == name; })) {
                    throw new Exceptions_1.NodeError('Duplicated test name: ' + name, node);
                }
                var wrapperSuite = new ATLSuite_1.default(name);
                wrapperSuite.atl = suite.atl;
                wrapperSuite.descriptor = YAML_1.YAMLAstHelpers.toObject(node);
                wrapperSuite.test = parseTest(node, suite, wrapperSuite);
                wrapperSuite.test.method = method.method;
                wrapperSuite.test.uri = method.url;
                suite.suites.push(wrapperSuite);
            }
        }
        else {
            throw new Exceptions_1.NodeError('Invalid node: ' + name, node);
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
                throw new Exceptions_1.NodeError("timeout must be a number > 0", node);
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
            test.wrapperSuite.skip = !!YAML_1.YAMLAstHelpers.readScalar(node);
        }
    },
    soft: function (suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            test.wrapperSuite.soft = !!YAML_1.YAMLAstHelpers.readScalar(node);
        }
    }
};
function parseSuites(sequenceName, node, instance) {
    var suite = new ATLSuite_1.default(sequenceName);
    suite.atl = instance;
    suite.suites = [];
    YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteSuite, false, suite);
    if (suite.skip) {
        // skips all the inner suites and tests
        var recursiveSkip_1 = function (suite) {
            suite.skip = true;
            suite.suites && suite.suites.forEach(recursiveSkip_1);
        };
        recursiveSkip_1(suite);
    }
    return suite;
}
exports.parseSuites = parseSuites;
function parseTest(node, suite, wrapperSuite) {
    var test = new ATLTest_1.default;
    test.wrapperSuite = wrapperSuite;
    test.suite = suite;
    test.lowLevelNode = node;
    test.request.headers = test.request.headers || {};
    YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteTest, true, suite, test);
    if (!test.response || !test.response.status) {
        test.response.status = 200;
    }
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
                new Exceptions_1.NodeError("request.attach.* must be a path", node);
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
            new Exceptions_1.NodeError("you CAN'T use content-type AND form fields", node);
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
            new Exceptions_1.NodeError("you CAN'T use content-type AND urlencoded form", node);
        }
        test.request.urlencoded = value;
    }
};
var interpreteResponse = (_a = {
        headers: function (suite, test, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var value_1 = YAML_1.YAMLAstHelpers.toObject(node);
                test.response.headers = test.response.headers || {};
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
                new Exceptions_1.NodeError("response.content-type alredy registered as request.header.content-type You can not use BOTH", node);
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
                    node.errors.push(new Exceptions_1.NodeError("response.body.take.* must be a pointer ex: !!variable myValue", node));
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
                new Exceptions_1.NodeError("response.body.take must be a sequence of pointers or a !!variable", node);
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
        new Exceptions_1.NodeError("request must be a map", node);
    }
}
function parseResponse(test, node) {
    test.response.lowLevelNode = node;
    if (YAML_1.YAMLAstHelpers.isMap(node)) {
        YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteResponse, true, test.suite, test);
    }
    else {
        new Exceptions_1.NodeError("response must be a map", node);
    }
}
function parseResponseBody(test, responseBody) {
    test.response.body = {};
    test.response.body.lowLevelNode = responseBody;
    if (YAML_1.YAMLAstHelpers.isMap(responseBody)) {
        YAML_1.YAMLAstHelpers.iterpretMap(responseBody, interpreteResponseBody, true, test.suite, test);
    }
    else {
        new Exceptions_1.NodeError("response.body must be a map", responseBody);
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
function cloneObjectUsingPointers(baseObject, store, fsResolver) {
    if (typeof baseObject !== "object") {
        return baseObject;
    }
    return cloneObject(baseObject, store, fsResolver);
}
exports.cloneObjectUsingPointers = cloneObjectUsingPointers;
function cloneObject(obj, store, fsResolver) {
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
    if (obj instanceof FileSystem_1.IncludedFile) {
        if (!fsResolver) {
            return undefined;
        }
        var content = void 0;
        content = obj.content(fsResolver);
        if (content === null) {
            console.error("cloneObject::Error::Failed to load " + obj.path);
            return undefined;
        }
        if (obj.path.toLowerCase().substr(-5) == '.json') {
            try {
                return JSON.parse(content);
            }
            catch (e) {
                console.error("cloneObject::Error::Failed to load " + obj.path + ". Invalid JSON: " + e.toString());
                return undefined;
            }
        }
        return content;
    }
    // Handle Array (return a full slice of the array)
    if (obj instanceof Array) {
        var newArray = obj.slice();
        return newArray.map(function (x) { return cloneObject(x, store, fsResolver); });
    }
    if (obj instanceof exports.pointerLib.Pointer) {
        var result = void 0;
        try {
            var gottenValue = obj.get(store);
            result = cloneObject(gottenValue, store, fsResolver);
        }
        catch (e) {
            console.error("cloneObject::Error", e);
            throw e;
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
                copy[attr] = cloneObject(obj[attr], store, fsResolver);
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
var _a, _b;
//# sourceMappingURL=ATLHelpers.js.map