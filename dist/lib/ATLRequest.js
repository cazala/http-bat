"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// NODE
var util_1 = require('util');
var url = require('url');
var path = require('path');
var queryString = require('querystring');
// LOCAL
var ATLHelpers_1 = require('./ATLHelpers');
var Pointer_1 = require('./Pointer');
var Interpolation = require('./Interpolation');
var Runnable_1 = require('./Runnable');
var ATLRequest = (function (_super) {
    __extends(ATLRequest, _super);
    function ATLRequest(test, ATLRunner) {
        var _this = this;
        _super.call(this, function (runnable) {
            _this.urlObject = url.parse(_this.test.uri, true);
            _this.urlObject.query = _this.urlObject.query || {};
            if (typeof _this.urlObject.query == "string") {
                _this.urlObject.query = queryString.parse(_this.urlObject.query);
            }
            if (_this.test.request.queryParameters) {
                if ('search' in _this.urlObject)
                    delete _this.urlObject.search;
                var qsParams = ATLHelpers_1.cloneObjectUsingPointers(_this.test.request.queryParameters, _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver);
                for (var i in qsParams) {
                    var typeOfValue = typeof qsParams[i];
                    if (typeOfValue == 'undefined')
                        continue;
                    if (typeOfValue != 'string' && typeOfValue != 'number') {
                        throw new Error("Only strings and numbers are allowed on queryParameters. " + i + "=" + util_1.inspect(qsParams[i]));
                    }
                    _this.urlObject.query[i] = qsParams[i];
                }
            }
            var uriParametersBag = {};
            for (var i in _this.test.uriParameters) {
                var value = null;
                if (_this.test.uriParameters[i] instanceof Pointer_1.Pointer) {
                    value = _this.test.uriParameters[i].get(_this.test.suite.atl.options.variables);
                }
                else {
                    value = _this.test.uriParameters[i];
                }
                var typeOfValue = typeof value;
                if (typeOfValue != 'string' && typeOfValue != 'number') {
                    throw new Error("Only strings and numbers are allowed on uriParameters. " + i + "=" + util_1.inspect(value) + " (" + util_1.inspect(_this.test.uriParameters[i]) + ")");
                }
                uriParametersBag[i] = value;
            }
            _this.urlObject.pathname = Interpolation.interpolateString(_this.urlObject.pathname, uriParametersBag);
            _this.urlObject.pathname = Interpolation.interpolateString(_this.urlObject.pathname, _this.test.suite.atl.options.variables);
            Interpolation.ensureAllInterpolations(_this.urlObject.pathname);
            _this.url = url.format(_this.urlObject);
            var req = _this.superAgentRequest = _this.ATLRunner.agent[_this.test.method.toLowerCase()](_this.url);
            // we must send some data..
            if (_this.test.request) {
                if (_this.test.request.headers) {
                    var headers = ATLHelpers_1.cloneObjectUsingPointers(_this.test.request.headers, _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver);
                    for (var h in headers) {
                        req.set(h, headers[h] == undefined ? '' : headers[h].toString());
                    }
                }
                if (_this.test.request.json) {
                    var data = ATLHelpers_1.cloneObjectUsingPointers(_this.test.request.json, _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver);
                    req.send(data);
                }
                if (_this.test.request.attach) {
                    if (!_this.test.suite.atl.options.path) {
                        throw new Error("attach is not allowed using RAW definitions");
                    }
                    for (var i in _this.test.request.attach) {
                        var currentAttachment = _this.test.request.attach[i];
                        req.attach(currentAttachment.key, path.resolve(_this.test.suite.atl.options.path, currentAttachment.value));
                    }
                }
                if (_this.test.request.form) {
                    req.type('form');
                    for (var i in _this.test.request.form) {
                        var currentAttachment = ATLHelpers_1.cloneObjectUsingPointers(_this.test.request.form[i], _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver);
                        req.field(currentAttachment.key, currentAttachment.value);
                    }
                }
                if (_this.test.request.urlencoded) {
                    req.type('form');
                    var holder_1 = {};
                    _this.test.request.urlencoded.forEach(function (x) {
                        if (x.key in holder_1) {
                            if (!(holder_1[x.key] instanceof Array)) {
                                holder_1[x.key] = [holder_1[x.key]];
                            }
                            holder_1[x.key].push(ATLHelpers_1.cloneObjectUsingPointers(x.value, _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver));
                        }
                        else {
                            holder_1[x.key] = ATLHelpers_1.cloneObjectUsingPointers(x.value, _this.test.suite.atl.options.variables, _this.test.suite.atl.options.FSResolver);
                        }
                    });
                    req.send(holder_1);
                }
            }
            var prom = ATLHelpers_1.flatPromise();
            req.timeout(_this.test.timeout);
            req.end(function (err, res) {
                if (err) {
                    return prom.rejecter(new Error(err.toString()));
                }
                return prom.resolver(res);
            });
            return prom.promise;
        });
        this.test = test;
        this.ATLRunner = ATLRunner;
        this.name = this.test.method.toUpperCase() + ' ' + this.test.uri;
        this.onCancel(function () { return _this.superAgentRequest && _this.superAgentRequest.abort(); });
    }
    return ATLRequest;
}(Runnable_1.default));
exports.ATLRequest = ATLRequest;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ATLRequest;
//# sourceMappingURL=ATLRequest.js.map