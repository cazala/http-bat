"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ATLHelpers_1 = require('./ATLHelpers');
var util_1 = require('util');
var _ = require('lodash');
var Runnable_1 = require('./Runnable');
var ATLError = (function (_super) {
    __extends(ATLError, _super);
    function ATLError(message) {
        _super.call(this, message);
        this.text = '';
        this.message = '';
        this.text = message;
    }
    ATLError.prototype.toString = function () {
        return this.text;
    };
    ATLError.prototype.inspect = function () {
        return this.text;
    };
    return ATLError;
}(Error));
exports.ATLError = ATLError;
var ATLResponseAssertion = (function (_super) {
    __extends(ATLResponseAssertion, _super);
    function ATLResponseAssertion(request) {
        var _this = this;
        _super.call(this, function (runnable) {
            var result = _this.validate(_this.request.value);
            if (!result)
                return Promise.resolve(true);
            return result;
        });
        this.request = request;
        this.skip = false;
        this.addDependency(request);
    }
    ATLResponseAssertion.prototype.emitError = function (data) {
        var message = data.message
            .replace('{actual}', util_1.inspect(data.actual))
            .replace('{expected}', util_1.inspect(data.expected));
        var err = new ATLError(message);
        err.actual = data.actual;
        err.expected = data.expected;
        err.assertion = this;
        throw err;
    };
    ATLResponseAssertion.prototype.getObjectValue = function (object) {
        return ATLHelpers_1.cloneObjectUsingPointers(object, this.request.test.suite.atl.options.variables, this.request.test.suite.atl.options.FSResolver);
    };
    return ATLResponseAssertion;
}(Runnable_1.Runnable));
exports.ATLResponseAssertion = ATLResponseAssertion;
var CommonAssertions;
(function (CommonAssertions) {
    var PromiseAssertion = (function (_super) {
        __extends(PromiseAssertion, _super);
        function PromiseAssertion(parent, name, evaluator) {
            _super.call(this, parent);
            this.evaluator = evaluator;
            this.name = name;
        }
        PromiseAssertion.prototype.validate = function (response) {
            return this
                .evaluator(response)
                .catch(function (err) { return Promise.resolve(err); });
        };
        return PromiseAssertion;
    }(ATLResponseAssertion));
    CommonAssertions.PromiseAssertion = PromiseAssertion;
    var StatusCodeAssertion = (function (_super) {
        __extends(StatusCodeAssertion, _super);
        function StatusCodeAssertion(parent, statusCode) {
            _super.call(this, parent);
            this.statusCode = statusCode;
            this.name = "response.status == " + statusCode;
        }
        StatusCodeAssertion.prototype.validate = function (response) {
            if (response.status != this.statusCode) {
                debugger;
                this.emitError({
                    message: 'expected status code {expected} got {actual} instead',
                    expected: this.statusCode,
                    actual: response.status
                });
            }
        };
        return StatusCodeAssertion;
    }(ATLResponseAssertion));
    CommonAssertions.StatusCodeAssertion = StatusCodeAssertion;
    var BodyEqualsAssertion = (function (_super) {
        __extends(BodyEqualsAssertion, _super);
        function BodyEqualsAssertion(parent, bodyIs) {
            _super.call(this, parent);
            this.bodyIs = bodyIs;
            this.name = "response.body is #value";
        }
        BodyEqualsAssertion.prototype.validate = function (response) {
            if (this.bodyIs && typeof this.bodyIs == "object" && this.bodyIs instanceof RegExp) {
                /* istanbul ignore if */
                if (!this.bodyIs.test(response.text)) {
                    this.emitError({
                        message: 'expected response.body to match {expected}, got {actual}',
                        expected: this.bodyIs,
                        actual: response.text
                    });
                }
            }
            else {
                var takenBody = void 0;
                if (typeof this.bodyIs == "string") {
                    takenBody = response.text;
                }
                else {
                    takenBody = response.body;
                }
                var bodyEquals = this.getObjectValue(this.bodyIs);
                /* istanbul ignore if */
                if (!_.isEqual(bodyEquals, takenBody)) {
                    this.emitError({
                        message: 'expected response.body {expected}, got {actual}',
                        expected: bodyEquals,
                        actual: takenBody
                    });
                }
            }
        };
        return BodyEqualsAssertion;
    }(ATLResponseAssertion));
    CommonAssertions.BodyEqualsAssertion = BodyEqualsAssertion;
    var BodyMatchesAssertion = (function (_super) {
        __extends(BodyMatchesAssertion, _super);
        function BodyMatchesAssertion(parent, key, value) {
            _super.call(this, parent);
            this.key = key;
            this.value = value;
            this.name = "response.body::" + key;
        }
        BodyMatchesAssertion.prototype.validate = function (response) {
            var value = this.getObjectValue(this.value);
            var readed = _.get(response.body, this.key);
            if ((!(value instanceof RegExp) && !_.isEqual(readed, value))
                ||
                    ((value instanceof RegExp) && !value.test(readed))) {
                this.emitError({
                    message: 'expected response.body::' + this.key + ' to match {expected}, got {actual}',
                    expected: value,
                    actual: readed
                });
            }
        };
        return BodyMatchesAssertion;
    }(ATLResponseAssertion));
    CommonAssertions.BodyMatchesAssertion = BodyMatchesAssertion;
    var CopyBodyValueOperation = (function (_super) {
        __extends(CopyBodyValueOperation, _super);
        function CopyBodyValueOperation(parent, key, keyValue) {
            _super.call(this, parent);
            this.key = key;
            this.keyValue = keyValue;
            this.name = "response.body::" + key + " >> !variables " + keyValue.path;
        }
        CopyBodyValueOperation.prototype.validate = function (response) {
            if (this.key === '*') {
                this.keyValue.set(this.request.test.suite.atl.options.variables, response.body);
            }
            else {
                var takenValue = _.get(response.body, this.key);
                this.keyValue.set(this.request.test.suite.atl.options.variables, takenValue);
            }
        };
        return CopyBodyValueOperation;
    }(ATLResponseAssertion));
    CommonAssertions.CopyBodyValueOperation = CopyBodyValueOperation;
    var ValidateSchemaOperation = (function (_super) {
        __extends(ValidateSchemaOperation, _super);
        function ValidateSchemaOperation(parent, schema) {
            _super.call(this, parent);
            this.schema = schema;
            this.name = "response.body schema " + schema;
        }
        ValidateSchemaOperation.prototype.validate = function (response) {
            var v = this.request.test.suite.atl.obtainSchemaValidator(this.schema);
            var validationResult = v(response.body);
            if (!validationResult.valid) {
                var errors_1 = ["Schema error:"];
                validationResult.errors && validationResult.errors.forEach(function (x) { return errors_1.push("  " + x.stack); });
                this.emitError({ message: errors_1.join('\n') });
            }
        };
        return ValidateSchemaOperation;
    }(ATLResponseAssertion));
    CommonAssertions.ValidateSchemaOperation = ValidateSchemaOperation;
    var HeaderMatchesAssertion = (function (_super) {
        __extends(HeaderMatchesAssertion, _super);
        function HeaderMatchesAssertion(parent, header, value) {
            _super.call(this, parent);
            this.header = header;
            this.value = value;
            this.header = header.toLowerCase();
            this.name = "response.header::" + header;
        }
        HeaderMatchesAssertion.prototype.validate = function (response) {
            var value = this.getObjectValue(this.value);
            var readed = response.get(this.header);
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
                this.emitError({
                    message: 'readed value of header MUST be string, number or undefined, got {expected} instead. response.header::' + this.header + ' is {actual}',
                    expected: value,
                    actual: readed
                });
            }
            if ((!(value instanceof RegExp) && !_.isEqual(readed, value))
                ||
                    ((value instanceof RegExp) && !value.test(readed))) {
                this.emitError({
                    message: 'expected response.header::' + this.header + ' to match {expected}, got {actual}',
                    expected: value,
                    actual: readed
                });
            }
        };
        return HeaderMatchesAssertion;
    }(ATLResponseAssertion));
    CommonAssertions.HeaderMatchesAssertion = HeaderMatchesAssertion;
})(CommonAssertions = exports.CommonAssertions || (exports.CommonAssertions = {}));
//# sourceMappingURL=ATLAssertion.js.map