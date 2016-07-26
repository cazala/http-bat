"use strict";
const ATLHelpers_1 = require('./ATLHelpers');
const util_1 = require('util');
const _ = require('lodash');
class ATLError extends Error {
    constructor(message) {
        super(message);
        this.text = '';
        this.message = '';
        this.text = message;
    }
    toString() {
        return this.text;
    }
    inspect() {
        return this.text;
    }
}
exports.ATLError = ATLError;
class ATLAssertion {
    constructor(parent) {
        this.parent = parent;
        this.skip = false;
        this.promise = Promise.reject(null);
    }
    error(data) {
        let message = data.message
            .replace('{actual}', util_1.inspect(data.actual))
            .replace('{expected}', util_1.inspect(data.expected));
        let err = new ATLError(message);
        err.actual = data.actual;
        err.expected = data.expected;
        err.assertion = this;
        throw err;
    }
    getObjectValue(object) {
        return ATLHelpers_1.cloneObjectUsingPointers(object, this.parent.suite.atl.options.variables, this.parent.suite.atl.options.FSResolver);
    }
}
exports.ATLAssertion = ATLAssertion;
class ATLResponseAssertion extends ATLAssertion {
    constructor(test) {
        super(test);
        this.prom = ATLHelpers_1.flatPromise();
        this.promise = this.prom.promise;
        if (test.skip) {
            this.prom.rejecter(new ATLHelpers_1.CanceledError);
        }
        else {
            test
                .requester
                .promise
                .then(response => {
                try {
                    let result = this.validate(response);
                    if (!result)
                        return this.prom.resolver();
                    result.then(() => this.prom.resolver());
                    result.catch(err => this.prom.rejecter(err));
                }
                catch (err) {
                    err.assertion = this;
                    this.prom.rejecter(err);
                }
            });
            // we don't care about IO errors
            test
                .requester
                .promise
                .catch(err => this.prom.rejecter(err));
        }
    }
    cancel() {
        this.prom.rejecter(new ATLHelpers_1.CanceledError);
    }
}
exports.ATLResponseAssertion = ATLResponseAssertion;
var CommonAssertions;
(function (CommonAssertions) {
    class PromiseAssertion extends ATLResponseAssertion {
        constructor(parent, name, evaluator) {
            super(parent);
            this.evaluator = evaluator;
            this.name = name;
        }
        validate(response) {
            return this
                .evaluator(response)
                .catch(err => Promise.resolve(err));
        }
    }
    CommonAssertions.PromiseAssertion = PromiseAssertion;
    class StatusCodeAssertion extends ATLResponseAssertion {
        constructor(parent, statusCode) {
            super(parent);
            this.statusCode = statusCode;
            this.name = "response.status == " + statusCode;
        }
        validate(response) {
            if (response.status != this.statusCode) {
                this.error({
                    message: 'expected status code {expected} got {actual} instead',
                    expected: this.statusCode,
                    actual: response.status
                });
            }
        }
    }
    CommonAssertions.StatusCodeAssertion = StatusCodeAssertion;
    class BodyEqualsAssertion extends ATLResponseAssertion {
        constructor(parent, bodyIs) {
            super(parent);
            this.bodyIs = bodyIs;
            this.name = "response.body is #value";
        }
        validate(response) {
            if (this.bodyIs && typeof this.bodyIs == "object" && this.bodyIs instanceof RegExp) {
                /* istanbul ignore if */
                if (!this.bodyIs.test(response.text)) {
                    this.error({
                        message: 'expected response.body to match {expected}, got {actual}',
                        expected: this.bodyIs,
                        actual: response.text
                    });
                }
            }
            else {
                let takenBody;
                if (typeof this.bodyIs == "string") {
                    takenBody = response.text;
                }
                else {
                    takenBody = response.body;
                }
                console.log(this.parent.suite.name, " BODY IS");
                console.dir(this.bodyIs);
                let bodyEquals = this.getObjectValue(this.bodyIs);
                console.dir(bodyEquals);
                /* istanbul ignore if */
                if (!_.isEqual(bodyEquals, takenBody)) {
                    this.error({
                        message: 'expected response.body {expected}, got {actual}',
                        expected: bodyEquals,
                        actual: takenBody
                    });
                }
            }
        }
    }
    CommonAssertions.BodyEqualsAssertion = BodyEqualsAssertion;
    class BodyMatchesAssertion extends ATLResponseAssertion {
        constructor(parent, key, value) {
            super(parent);
            this.key = key;
            this.value = value;
            this.name = "response.body::" + key;
        }
        validate(response) {
            let value = this.getObjectValue(this.value);
            let readed = _.get(response.body, this.key);
            if ((!(value instanceof RegExp) && !_.isEqual(readed, value))
                ||
                    ((value instanceof RegExp) && !value.test(readed))) {
                this.error({
                    message: 'expected response.body::' + this.key + ' to match {expected}, got {actual}',
                    expected: value,
                    actual: readed
                });
            }
        }
    }
    CommonAssertions.BodyMatchesAssertion = BodyMatchesAssertion;
    class CopyBodyValueOperation extends ATLResponseAssertion {
        constructor(parent, key, value) {
            super(parent);
            this.key = key;
            this.value = value;
            this.name = "response.body::" + key + " >> !variables " + value.path;
        }
        validate(response) {
            if (this.key === '*') {
                this.value.set(this.parent.suite.atl.options.variables, response.body);
            }
            else {
                let takenValue = _.get(response.body, this.key);
                this.value.set(this.parent.suite.atl.options.variables, takenValue);
            }
        }
    }
    CommonAssertions.CopyBodyValueOperation = CopyBodyValueOperation;
    class ValidateSchemaOperation extends ATLResponseAssertion {
        constructor(parent, schema) {
            super(parent);
            this.schema = schema;
            this.name = "response.body schema " + schema;
        }
        validate(response) {
            let v = this.parent.suite.atl.obtainSchemaValidator(this.schema);
            let validationResult = v(response.body);
            if (!validationResult.valid) {
                let errors = ["Schema error:"];
                validationResult.errors && validationResult.errors.forEach(x => errors.push("  " + x.stack));
                this.error({ message: errors.join('\n') });
            }
        }
    }
    CommonAssertions.ValidateSchemaOperation = ValidateSchemaOperation;
    class HeaderMatchesAssertion extends ATLResponseAssertion {
        constructor(parent, header, value) {
            super(parent);
            this.header = header;
            this.value = value;
            this.header = header.toLowerCase();
            this.name = "response.header::" + header;
        }
        validate(response) {
            let value = this.getObjectValue(this.value);
            let readed = response.get(this.header);
            if (this.header === 'content-type') {
                if (readed.indexOf(';') != -1) {
                    readed = readed.substr(0, readed.indexOf(';')).trim();
                }
            }
            if (typeof value != "string" &&
                typeof value != "number" &&
                typeof value != "undefined" &&
                typeof value != "object" &&
                !(value instanceof RegExp) &&
                value !== null) {
                this.error({
                    message: 'readed value of header MUST be string, number or undefined, got {expected} instead. response.header::' + this.header + ' is {actual}',
                    expected: value,
                    actual: readed
                });
            }
            if ((!(value instanceof RegExp) && !_.isEqual(readed, value))
                ||
                    ((value instanceof RegExp) && !value.test(readed))) {
                this.error({
                    message: 'expected response.header::' + this.header + ' to match {expected}, got {actual}',
                    expected: value,
                    actual: readed
                });
            }
        }
    }
    CommonAssertions.HeaderMatchesAssertion = HeaderMatchesAssertion;
})(CommonAssertions = exports.CommonAssertions || (exports.CommonAssertions = {}));
//# sourceMappingURL=ATLAssertion.js.map