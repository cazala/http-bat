"use strict";
// NODE
const util_1 = require('util');
const url = require('url');
const path = require('path');
const queryString = require('querystring');
// LOCAL
const ATLHelpers_1 = require('./ATLHelpers');
const Pointer_1 = require('./Pointer');
const Interpolation = require('./Interpolation');
class ATLRequest {
    constructor(test) {
        this.test = test;
        this.flatPromise = ATLHelpers_1.flatPromise();
        this.promise = this.flatPromise.promise;
    }
    run() {
        try {
            this._run();
        }
        catch (e) {
            this.flatPromise.rejecter(e);
        }
        return this.promise;
    }
    _run() {
        this.urlObject = url.parse(this.test.uri, true);
        this.urlObject.query = this.urlObject.query || {};
        if (typeof this.urlObject.query == "string") {
            this.urlObject.query = queryString.parse(this.urlObject.query);
        }
        if (this.test.request.queryParameters) {
            if ('search' in this.urlObject)
                delete this.urlObject.search;
            let qsParams = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.queryParameters, this.test.suite.atl.options.variables);
            for (let i in qsParams) {
                let typeOfValue = typeof qsParams[i];
                if (typeOfValue == 'undefined')
                    continue;
                if (typeOfValue != 'string' && typeOfValue != 'number') {
                    throw new Error("Only strings and numbers are allowed on queryParameters. " + i + "=" + util_1.inspect(qsParams[i]));
                }
                this.urlObject.query[i] = qsParams[i];
            }
        }
        let uriParametersBag = {};
        for (let i in this.test.uriParameters) {
            let value = null;
            if (this.test.uriParameters[i] instanceof Pointer_1.Pointer) {
                value = this.test.uriParameters[i].get(this.test.suite.atl.options.variables);
            }
            else {
                value = this.test.uriParameters[i];
            }
            let typeOfValue = typeof value;
            if (typeOfValue != 'string' && typeOfValue != 'number') {
                throw new Error("Only strings and numbers are allowed on uriParameters. " + i + "=" + util_1.inspect(value) + " (" + util_1.inspect(this.test.uriParameters[i]) + ")");
            }
            uriParametersBag[i] = value;
        }
        this.urlObject.pathname = Interpolation.interpolateString(this.urlObject.pathname, uriParametersBag);
        this.urlObject.pathname = Interpolation.interpolateString(this.urlObject.pathname, this.test.suite.atl.options.variables);
        Interpolation.ensureAllInterpolations(this.urlObject.pathname);
        this.url = url.format(this.urlObject);
        let req = this.superAgentRequest = this.test.suite.atl.agent[this.test.method.toLowerCase()](this.url);
        // we must send some data..
        if (this.test.request) {
            if (this.test.request.headers) {
                let headers = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.headers, this.test.suite.atl.options.variables);
                for (let h in headers) {
                    req.set(h, headers[h] == undefined ? '' : headers[h].toString());
                }
            }
            if (this.test.request.json) {
                let data = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.json, this.test.suite.atl.options.variables);
                req.send(data);
            }
            if (this.test.request.attach) {
                if (!this.test.suite.atl.options.path) {
                    throw new Error("attach is not allowed using RAW definitions");
                }
                for (let i in this.test.request.attach) {
                    let currentAttachment = this.test.request.attach[i];
                    req.attach(currentAttachment.key, path.resolve(this.test.suite.atl.options.path, currentAttachment.value));
                }
            }
            if (this.test.request.form) {
                req.type('form');
                for (let i in this.test.request.form) {
                    let currentAttachment = ATLHelpers_1.cloneObjectUsingPointers(this.test.request.form[i], this.test.suite.atl.options.variables);
                    req.field(currentAttachment.key, currentAttachment.value);
                }
            }
            if (this.test.request.urlencoded) {
                req.type('form');
                let holder = {};
                this.test.request.urlencoded.forEach(x => {
                    if (x.key in holder) {
                        if (!(holder[x.key] instanceof Array)) {
                            holder[x.key] = [holder[x.key]];
                        }
                        holder[x.key].push(ATLHelpers_1.cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables));
                    }
                    else {
                        holder[x.key] = ATLHelpers_1.cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables);
                    }
                });
                req.send(holder);
            }
        }
        req.timeout(this.test.timeout);
        req.end((err, res) => {
            this.superAgentResponse = res;
            if (err) {
                return this.flatPromise.rejecter(new Error(err.toString()));
            }
            return this.flatPromise.resolver(res);
        });
    }
    cancel() {
        this.flatPromise.rejecter(new ATLHelpers_1.CanceledError());
        try {
            this.superAgentRequest && this.superAgentRequest.abort();
        }
        catch (e) { }
    }
}
exports.ATLRequest = ATLRequest;
//# sourceMappingURL=ATLRequest.js.map