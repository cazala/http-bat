"use strict";
// NODE
var util_1 = require('util');
var url = require('url');
var path = require('path');
var queryString = require('querystring');
var _ = require('lodash');
// LOCAL
var ATLHelpers_1 = require('./ATLHelpers');
var Pointer_1 = require('./Pointer');
var reIsInterpolation = /\{([^.[\]\}\{]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\3)[^\\\{\}]|\\.)*?)\3)\]|(?=(\.|\[\])(?:\5|$)))\}{1}/g;
var ATLRequest = (function () {
    function ATLRequest(test) {
        this.test = test;
        this.flatPromise = ATLHelpers_1.flatPromise();
        this.promise = this.flatPromise.promise;
    }
    ATLRequest.prototype.run = function () {
        try {
            this._run();
        }
        catch (e) {
            this.flatPromise.rejecter(e);
        }
        return this.promise;
    };
    ATLRequest.prototype._run = function () {
        var _this = this;
        this.urlObject = url.parse(this.test.uri, true);
        this.urlObject.query = this.urlObject.query || {};
        if (typeof this.urlObject.query == "string") {
            this.urlObject.query = queryString.parse(this.urlObject.query);
        }
        if (this.test.request.queryParameters) {
            if ('search' in this.urlObject)
                delete this.urlObject.search;
            var qsParams = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.queryParameters, this.test.suite.atl.options.variables);
            for (var i in qsParams) {
                var typeOfValue = typeof qsParams[i];
                if (typeOfValue == 'undefined')
                    continue;
                if (typeOfValue != 'string' && typeOfValue != 'number') {
                    throw new Error("Only strings and numbers are allowed on queryParameters. " + i + "=" + util_1.inspect(qsParams[i]));
                }
                this.urlObject.query[i] = qsParams[i];
            }
        }
        var uriParametersBag = {};
        for (var i in this.test.uriParameters) {
            var value = null;
            if (this.test.uriParameters[i] instanceof Pointer_1.Pointer) {
                value = this.test.uriParameters[i].get(this.test.suite.atl.options.variables);
            }
            else {
                value = this.test.uriParameters[i];
            }
            var typeOfValue = typeof value;
            if (typeOfValue != 'string' && typeOfValue != 'number') {
                throw new Error("Only strings and numbers are allowed on uriParameters. " + i + "=" + util_1.inspect(value));
            }
            uriParametersBag[i] = value;
        }
        this.urlObject.pathname = this.urlObject.pathname.replace(reIsInterpolation, function (fulltext, match) {
            var value = null;
            if (match in uriParametersBag) {
                value = uriParametersBag[match];
            }
            else {
                value = _.get(_this.test.suite.atl.options.variables, match);
            }
            var typeOfValue = typeof value;
            if (typeOfValue == "undefined")
                throw new Error("Can not resolve uriParameter " + match);
            if (typeOfValue != 'string' && typeOfValue != 'number') {
                throw new Error("Invalid uriParameter: " + match + "=" + util_1.inspect(value));
            }
            return encodeURIComponent(value);
        });
        this.url = url.format(this.urlObject);
        var req = this.superAgentRequest = this.test.suite.atl.agent[this.test.method.toLowerCase()](this.url);
        // we must send some data..
        if (this.test.request) {
            if (this.test.request.headers) {
                var headers = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.headers, this.test.suite.atl.options.variables);
                for (var h in headers) {
                    req.set(h, headers[h] == undefined ? '' : headers[h].toString());
                }
            }
            if (this.test.request.json) {
                var data = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.json, this.test.suite.atl.options.variables);
                req.send(data);
            }
            if (this.test.request.attach) {
                if (!this.test.suite.atl.options.path) {
                    throw new Error("attach is not allowed using RAW definitions");
                }
                for (var i in this.test.request.attach) {
                    var currentAttachment = this.test.request.attach[i];
                    req.attach(currentAttachment.key, path.resolve(this.test.suite.atl.options.path, currentAttachment.value));
                }
            }
            if (this.test.request.form) {
                req.type('form');
                for (var i in this.test.request.form) {
                    var currentAttachment = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.form[i], this.test.suite.atl.options.variables);
                    req.field(currentAttachment.key, currentAttachment.value);
                }
            }
            if (this.test.request.urlencoded) {
                req.type('form');
                var holder_1 = {};
                this.test.request.urlencoded.forEach(function (x) {
                    if (x.key in holder_1) {
                        if (!(holder_1[x.key] instanceof Array)) {
                            holder_1[x.key] = [holder_1[x.key]];
                        }
                        holder_1[x.key].push(ATLHelpers_1.cloneObjectUsingPointers(x.value, _this.test.suite.atl.options.variables));
                    }
                    else {
                        holder_1[x.key] = ATLHelpers_1.cloneObjectUsingPointers(x.value, _this.test.suite.atl.options.variables);
                    }
                });
                req.send(holder_1);
            }
        }
        req.timeout(this.test.timeout);
        req.end(function (err, res) {
            _this.superAgentResponse = res;
            if (err) {
                return _this.flatPromise.rejecter(new Error(err.toString()));
            }
            return _this.flatPromise.resolver(res);
        });
    };
    ATLRequest.prototype.cancel = function () {
        this.flatPromise.rejecter(new ATLHelpers_1.CanceledError());
        try {
            this.superAgentRequest && this.superAgentRequest.abort();
        }
        catch (e) { }
    };
    return ATLRequest;
}());
exports.ATLRequest = ATLRequest;
//# sourceMappingURL=ATLRequest.js.map