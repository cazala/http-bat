"use strict";
// NODE
const util = require('util');
// NPM
const methods = require('methods');
exports.pointerLib = require('./Pointer');
const ATLAssertion_1 = require('./ATLAssertion');
const ATLRequest_1 = require('./ATLRequest');
const FileSystem_1 = require('./FileSystem');
const YAML_1 = require('./YAML');
/// ---
class CanceledError extends Error {
    constructor() {
        super('CANCELED');
    }
    inspect() {
        return 'CANCELED';
    }
}
exports.CanceledError = CanceledError;
/// ---
class ATLSuite {
    constructor(name) {
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
    run() {
        let mutex = this.dependsOn.length ? Promise.all(this.dependsOn.map(x => x.promise)) : Promise.resolve();
        mutex.then(() => {
            if (this.test) {
                let innerRun = this.test.run();
                innerRun.then(() => this.flatPromise.resolver());
                innerRun.catch(err => this.reject(err));
            }
            else if (this.suites) {
                if (!this.suites.length) {
                    this.flatPromise.resolver();
                }
                else {
                    let innerMutex = Promise.all(this.suites.map(x => x.run()));
                    innerMutex.then(() => this.flatPromise.resolver());
                    innerMutex.catch(err => {
                        this.reject(err);
                    });
                }
            }
            else
                this.flatPromise.rejecter(new Error('Invalid suite. No tests and no sub suites found. ' + this.name));
        });
        mutex.catch(err => {
            this.reject(err);
        });
        return this.promise;
    }
    reject(error) {
        if (this.skip && error instanceof Error) {
            this.flatPromise.resolver();
        }
        else {
            this.flatPromise.rejecter(error);
        }
        this.cancel(error);
    }
    cancel(err) {
        this.flatPromise.rejecter(err);
        if (this.test)
            this.test.cancel(err);
        if (this.suites && this.suites.length)
            this.suites.forEach(x => x.cancel(err));
    }
}
exports.ATLSuite = ATLSuite;
class ATLTest {
    constructor() {
        this.skip = false;
        this.timeout = 30000;
        this.response = {};
        this.request = {};
        this.flatPromise = flatPromise();
        this.promise = this.flatPromise.promise;
        this.requester = new ATLRequest_1.ATLRequest(this);
        this.assertions = [];
        this.requester.promise
            .catch(x => this.flatPromise.rejecter(x));
    }
    run() {
        if (this.skip) {
            this.flatPromise.resolver();
            return this.promise;
        }
        if (!this.assertions.length) {
            this.requester.promise
                .then(x => this.flatPromise.resolver());
        }
        else {
            let assertionResults = Promise.all(this.assertions.map(x => x.promise));
            assertionResults
                .then(assertionResults => {
                let errors = assertionResults.filter(x => !!x);
                if (errors.length) {
                    this.flatPromise.rejecter(errors);
                }
                else {
                    this.flatPromise.resolver();
                }
            });
            assertionResults
                .catch(errors => {
                this.flatPromise.rejecter(errors);
            });
        }
        this.requester.run();
        return this.promise;
    }
    cancel(err) {
        try {
            this.flatPromise.rejecter(err);
        }
        catch (e) {
        }
        this.assertions.forEach(x => {
            try {
                x.cancel();
            }
            catch (e) { }
        });
        try {
            this.requester.cancel();
        }
        catch (e) { }
    }
}
exports.ATLTest = ATLTest;
/// ---
const interpreteSuite = {
    skip(suite, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            let skip = YAML_1.YAMLAstHelpers.readScalar(node);
            suite.skip = !!skip;
        }
    },
    async(suite, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            let async = YAML_1.YAMLAstHelpers.readScalar(node);
            suite.async = !!async;
        }
    },
    UNKNOWN(suite, node, name) {
        let method = parseMethodHeader(name);
        if (method) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                if (suite.suites.some(x => x.name == name)) {
                    throw new YAML_1.NodeError('Duplicated test name: ' + name, node);
                }
                let testSuite = new ATLSuite(name);
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
const interpreteTest = {
    uriParameters(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            test.uriParameters = {};
            let object = YAML_1.YAMLAstHelpers.getMap(node);
            let keys = Object.keys(object);
            keys.forEach(key => {
                let val = YAML_1.YAMLAstHelpers.readScalar(object[key]) || object[key];
                ensureInstanceOf("uriParameters." + key, val, Number, String, exports.pointerLib.Pointer);
                test.uriParameters[key] = val;
            });
        }
    },
    description(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            let description = YAML_1.YAMLAstHelpers.readScalar(node);
            ensureInstanceOf("description", description, String);
            if (description.trim().length > 0) {
                test.description = description;
            }
        }
    },
    id(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String, Number)) {
            let id = YAML_1.YAMLAstHelpers.readScalar(node);
            test.testId = id.toString();
        }
    },
    timeout(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Number)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            ensureInstanceOf("timeout", value, Number);
            if (value <= 0)
                throw new YAML_1.NodeError("timeout must be a number > 0", node);
            test.timeout = value;
        }
    },
    queryParameters(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            test.request.queryParameters = test.request.queryParameters || {};
            let object = YAML_1.YAMLAstHelpers.getMap(node);
            let keys = Object.keys(object);
            keys.forEach(key => {
                let val = YAML_1.YAMLAstHelpers.readScalar(object[key]) || object[key];
                ensureInstanceOf("queryParameters." + key, val, Number, String, Boolean, exports.pointerLib.Pointer);
                test.request.queryParameters[key] = val;
            });
        }
    },
    headers(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let object = YAML_1.YAMLAstHelpers.getMap(node);
            let keys = Object.keys(object);
            keys.forEach(key => {
                let val = YAML_1.YAMLAstHelpers.readScalar(object[key]) || object[key];
                ensureInstanceOf("headers." + key, val, String, exports.pointerLib.Pointer);
                test.request.headers[key.toLowerCase()] = val;
            });
        }
    },
    request(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            parseRequest(test, node);
        }
    },
    response(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            parseResponse(test, node);
        }
    },
    skip(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            let id = YAML_1.YAMLAstHelpers.readScalar(node);
            test.skip = !!id;
            if (test.skip) {
                test.requester.cancel();
            }
        }
    }
};
function parseSuites(sequenceName, node, instance) {
    let suite = new ATLSuite(sequenceName);
    suite.atl = instance;
    suite.suites = [];
    YAML_1.YAMLAstHelpers.iterpretMap(node, interpreteSuite, false, suite);
    if (suite.skip) {
        // skips all the inner suites and tests
        const recursiveSkip = (suite) => {
            suite.skip = true;
            suite.suites && suite.suites.forEach(recursiveSkip);
            suite.test && (suite.test.skip = true);
        };
        recursiveSkip(suite);
    }
    return suite;
}
exports.parseSuites = parseSuites;
function parseTest(node, suite) {
    let test = new ATLTest;
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
const interpreteRequest = {
    json(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.toObject(node);
        test.request.json = value;
    },
    attach(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        test.request.attach = [];
        value.forEach(kvo => {
            if (typeof kvo.value != "string")
                new YAML_1.NodeError("request.attach.* must be a path", node);
            else
                test.request.attach.push(kvo);
        });
    },
    form(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        if (!('content-type' in test.request.headers)) {
            test.request.headers['content-type'] = "multipart/form-data";
        }
        else {
            new YAML_1.NodeError("you CAN'T use content-type AND form fields", node);
            return;
        }
        test.request.form = value;
    },
    urlencoded(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        if (!('content-type' in test.request.headers)) {
            test.request.headers['content-type'] = "application/x-www-form-urlencoded";
        }
        else {
            new YAML_1.NodeError("you CAN'T use content-type AND urlencoded form", node);
        }
        test.request.urlencoded = value;
    }
};
const interpreteResponse = {
    headers(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let value = YAML_1.YAMLAstHelpers.toObject(node);
            test.response.headers = test.response.headers || {};
            let keys = Object.keys(value);
            keys.forEach(key => {
                let val = value[key];
                ensureInstanceOf("response.headers." + key, val, String, exports.pointerLib.Pointer);
                test.response.headers[key.toLowerCase()] = val;
            });
        }
    },
    ['content-type'](suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.headers = test.response.headers || {};
            if ('content-type' in test.response.headers) {
                new YAML_1.NodeError("response.content-type alredy registered as request.header.content-type You can not use BOTH", node);
                return;
            }
            test.response.headers['content-type'] = value;
        }
    },
    status(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Number)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.status = parseInt(value) | 0;
        }
    },
    print(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.print = !!value;
        }
    },
    body(suite, test, node) {
        parseResponseBody(test, node);
    }
};
const interpreteResponseBody = {
    ['is'](suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.toObject(node);
        test.response.body.is = value;
    },
    matches(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.readKVOElems(node);
        test.response.body.matches = value;
    },
    schema(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            test.response.body.schema = value;
        }
    },
    take(suite, test, node) {
        if (YAML_1.YAMLAstHelpers.isSeq(node)) {
            let value = YAML_1.YAMLAstHelpers.readKVOElems(node);
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
            let value = YAML_1.YAMLAstHelpers.toObject(node);
            if (value instanceof exports.pointerLib.Pointer) {
                test.response.body.copyTo = value;
            }
            else {
                new YAML_1.NodeError("response.body.take must be a sequence of pointers or a !!variable", node);
            }
        }
    },
    print(suite, test, node) {
        let value = YAML_1.YAMLAstHelpers.readScalar(node);
        ensureInstanceOf("response.body.print", value, Boolean);
        test.response.body.print = value;
    }
};
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
function ensureInstanceOf(name, value, ...types) {
    for (let i = 0; i < types.length; i++) {
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
    throw new TypeError(name + " must be instance of " + types.map((x) => x && x.displayName || x && x.name || x.toString()).join(" | ") + " got " + util.inspect(value));
}
exports.ensureInstanceOf = ensureInstanceOf;
function parseMethodHeader(name) {
    let parts = name.split(/\s+/g);
    let method = null;
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
        let content;
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
        let newArray = obj.slice();
        return newArray.map(x => cloneObject(x, store, fsResolver));
    }
    if (obj instanceof exports.pointerLib.Pointer) {
        let result;
        try {
            let gottenValue = obj.get(store);
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
        let copy = new obj.constructor();
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) {
                copy[attr] = cloneObject(obj[attr], store, fsResolver);
            }
        }
        return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported. " + util.inspect(obj));
}
function flatPromise() {
    let result = {
        resolver: null,
        rejecter: null,
        promise: null
    };
    result.promise = new Promise((a, b) => {
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
    let err = new Error(msg);
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
    let err = new Error(msg);
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
                test.response.body.matches.forEach(kvo => {
                    test.assertions.push(new ATLAssertion_1.CommonAssertions.BodyMatchesAssertion(test, kvo.key, kvo.value));
                });
            }
            if (test.response.headers) {
                for (let h in test.response.headers) {
                    test.assertions.push(new ATLAssertion_1.CommonAssertions.HeaderMatchesAssertion(test, h, test.response.headers[h]));
                }
            }
            if (test.response.body.take) {
                let take = test.response.body.take;
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
//# sourceMappingURL=ATLHelpers.js.map