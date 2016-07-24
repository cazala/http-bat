"use strict";
// Node
const fs = require('fs');
const path = require('path');
const url = require('url');
const util = require('util');
// NPM
const _ = require('lodash');
const jsonschema = require('jsonschema');
const pathMatch = require('raml-path-match');
const ATLHelpers = require('./ATLHelpers');
const RAMLCoverageReporter_1 = require('../lib/RAMLCoverageReporter');
class CoverageData {
    constructor() {
        this.data = {};
    }
}
exports.CoverageData = CoverageData;
exports.GlobalCoverageDataCollector = new CoverageData();
let theGlobalObject = global;
theGlobalObject._$jscoverage = exports.GlobalCoverageDataCollector.data;
theGlobalObject._$jscoverage = exports.GlobalCoverageDataCollector.data;
class CoverageAssertion {
    constructor(name, validationFn, lowLevelAST) {
        this.name = name;
        this.validationFn = validationFn;
        this.lowLevelAST = lowLevelAST;
        this.valid = null;
        this.innerAssertions = [];
        /// Resolves when the validation is OK
        this.promise = ATLHelpers.flatPromise();
        this.promise.promise
            .then(x => {
            if (x) {
                this.error = x;
                this.valid = false;
                return Promise.reject(x);
            }
            else {
                delete this.error;
                this.valid = true;
                return Promise.resolve();
            }
        })
            .catch(x => {
            this.error = x;
            this.valid = false;
            return Promise.reject(x);
        });
        if (lowLevelAST) {
            this.src_file = lowLevelAST.unit().absolutePath();
            if (this.src_file) {
                this.src_line = lowLevelAST.unit().lineMapper().position(lowLevelAST.start()).line + 1;
                this.src_line_end = lowLevelAST.unit().lineMapper().position(lowLevelAST.end()).line + 1;
                this.src_start = lowLevelAST.start();
                this.src_end = lowLevelAST.end();
            }
        }
    }
    getCoverage() {
        if (this.src_file) {
            return {
                file: this.src_file,
                line: this.src_line,
                lineEnd: this.src_line_end,
                start: this.src_start,
                end: this.src_end,
                covered: this.valid
            };
        }
    }
    validate(res) {
        let waitForInner = Promise.resolve();
        try {
            if (!res || !res.length) {
                throw new NoMatchingResults;
            }
            if (this.validationFn) {
                let actualResult = this.validationFn(res);
                if (actualResult) {
                    if (!(actualResult instanceof Promise)) {
                        this.promise.rejecter(new Error(this.name + " does not return a Promise, got " + util.inspect(actualResult)));
                    }
                    else {
                        actualResult
                            .then(result => {
                            if (result) {
                                this.promise.rejecter(result);
                            }
                            else {
                                this.promise.resolver();
                            }
                        })
                            .catch(err => {
                            this.promise.rejecter(err);
                        });
                    }
                }
                else {
                    this.promise.resolver();
                }
            }
            else {
                this.promise.resolver();
            }
        }
        catch (e) {
            this.promise.rejecter(e);
        }
        if (this.innerAssertions.length) {
            waitForInner = Promise.all(this.innerAssertions.map(x => x.validate(res)));
        }
        // THIS METOD MUST RESOLVE EVERY TIME
        return this.promise.promise
            .then(error => waitForInner.then(() => error))
            .catch(error => waitForInner.then(() => Promise.resolve(error)));
    }
}
exports.CoverageAssertion = CoverageAssertion;
class CoverageResource {
    constructor(resource, ramlCoverage) {
        this.resource = resource;
        this.ramlCoverage = ramlCoverage;
        this.results = [];
        this.coverageTree = {};
        this.resourceJSON = null;
        this.uriParameters = [];
        this.relativeUrl = resource.completeRelativeUri();
        try {
            this.uriParameters = resource.absoluteUriParameters().map(x => x.toJSON());
        }
        catch (e) {
        }
        this.matches = pathMatch(this.relativeUrl, this.uriParameters);
        this.generateAssertions();
    }
    generateAssertions() {
        this.resourceAssertion = new CoverageAssertion(this.resource.completeRelativeUri());
        let methods = [];
        let type = this.resource.type();
        methods = methods.concat(this.resource.methods());
        methods.forEach(method => {
            let methodName = method.method().toUpperCase();
            let methodJson = method.toJSON();
            let methodAssetions = new CoverageAssertion(methodName, null, method.highLevel().lowLevel());
            this.resourceAssertion.innerAssertions.push(methodAssetions);
            let responses = [];
            let flatQueryParameters = {};
            // if (this.bat.ast.options.raml.traits) {
            let traits = method.is();
            for (let traitIndex = 0; traitIndex < traits.length; traitIndex++) {
                let trait = traits[traitIndex];
                let traitJSON = trait.trait().toJSON();
                let traitName = trait.name();
                if (traitJSON[traitName].queryParameters) {
                    for (let name in traitJSON[traitName].queryParameters) {
                        let param = traitJSON[traitName].queryParameters[name];
                        flatQueryParameters[param.name] = flatQueryParameters[param.name] || {};
                        _.merge(flatQueryParameters[param.name], param);
                    }
                }
                responses = responses.concat(trait.trait().responses());
            }
            // }
            // if (this.bat.ast.options.raml.resourceTypes) {
            if (type) {
                let typeMethods = type.resourceType().methods();
                typeMethods = typeMethods.filter(x => x.method().toUpperCase() == method.method().toUpperCase());
                typeMethods.forEach(m => {
                    let typeMethodJson = m.toJSON()[m.method().toLowerCase()];
                    if (typeMethodJson.queryParameters) {
                        for (let name in typeMethodJson.queryParameters) {
                            let param = typeMethodJson.queryParameters[name];
                            flatQueryParameters[param.name] = flatQueryParameters[param.name] || {};
                            _.merge(flatQueryParameters[param.name], param);
                        }
                    }
                    responses = responses.concat(m.responses());
                });
            }
            // }
            responses = responses.concat(method.responses());
            let flatResponses = {};
            responses.forEach(x => {
                let key = x.code().value();
                let flatResponse = flatResponses[key] = flatResponses[key] || {};
                flatResponse.status = key;
                flatResponse.statusAST = x.code().highLevel().lowLevel();
                x.headers().forEach(h => {
                    flatResponse.headers = flatResponse.headers || {};
                    flatResponse.headers[h.name()] = h || flatResponse.headers[h.name()];
                });
                flatResponse.bodies = {};
                x.body().forEach(h => {
                    let contentType = h.name();
                    let body = flatResponse.bodies[contentType] = flatResponse.bodies[contentType] || {
                        contentType: contentType
                    };
                    body.contentTypeAST = h.highLevel().lowLevel();
                    if (h.schemaContent()) {
                        body.schema = h.schema();
                        body.schemaString = h.schemaContent();
                    }
                });
            });
            if (Object.keys(flatQueryParameters).length) {
                Object.keys(flatQueryParameters)
                    .map(key => flatQueryParameters[key])
                    .forEach(qp => {
                    methodAssetions.innerAssertions.push(new CoverageAssertion('request.queryParameter::' + qp.name + ' must be present on some call', (results) => {
                        if (!results.some(x => x.test.method.toUpperCase() == methodName
                            &&
                                (qp.name in x.test.requester.urlObject.query)))
                            throw new (qp.required ? Error : NotImplementedError)("Query parameter not covered. Found permutations: " + util.inspect(results.map(x => x.test.requester.urlObject.query)));
                    }));
                    methodAssetions.innerAssertions.push(new CoverageAssertion('request.queryParameter::' + qp.name + ' must not be present on some call', (results) => {
                        if (!results.some(x => x.test.method.toUpperCase() == methodName
                            &&
                                !(qp.name in x.test.requester.urlObject.query)))
                            throw new NotImplementedError("Missing queryParameter not covered. Found permutations: " + util.inspect(results.map(x => x.test.requester.urlObject.query)));
                    }));
                });
            }
            if (responses.length == 0) {
                methodAssetions.innerAssertions.push(new CoverageAssertion('should have been called', (results) => {
                    if (!results.some(x => x.test.method.toUpperCase() == methodName))
                        throw new NoMatchingResults;
                }));
            }
            else {
                Object.keys(flatResponses).map(x => parseInt(x)).forEach(statusCode => {
                    let response = flatResponses[statusCode];
                    methodAssetions.innerAssertions.push(new CoverageAssertion('check ' + statusCode + ' response', (results) => {
                        let responses = results.filter(x => x.test.response.status == statusCode
                            &&
                                x.test.method.toUpperCase() == methodName);
                        if (!responses.length) {
                            throw new NotImplementedError('status code ' + statusCode + ' not covered');
                        }
                        else {
                            responses.forEach(x => {
                                if (x.response.status != statusCode)
                                    throw new CoverageError('unexpected response.status: ' + x.response.status);
                            });
                        }
                    }, response.statusAST));
                    let allBodies = Object.keys(response.bodies);
                    let responseAssertion = new CoverageAssertion(statusCode.toString());
                    methodAssetions.innerAssertions.push(responseAssertion);
                    allBodies.forEach(contentType => {
                        let bodyAsserion = new CoverageAssertion(contentType);
                        let actualBody = response.bodies[contentType];
                        responseAssertion.innerAssertions.push(bodyAsserion);
                        bodyAsserion.innerAssertions.push(new CoverageAssertion('response.headers::content-type == ' + contentType, (results) => {
                            let responses = results.filter(x => x.test.response.status == statusCode
                                &&
                                    x.test.method.toUpperCase() == methodName);
                            if (!responses.length) {
                                throw new NotImplementedError('status code ' + statusCode + ' not covered');
                            }
                            let withHeader = responses.filter(x => (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0);
                            if (!withHeader.length) {
                                throw new NotImplementedError('content-type "' + contentType + '" not covered, covered cases: [ '
                                    + (responses.filter(x => x.test.request.headers && x.test.request.headers['content-type']).map(x => x.test.request.headers['content-type']).join(' | ') || 'NONE')
                                    + ' ] received [ ' + responses.map(x => x.response.get('content-type') || 'undefined') + ' ]');
                            }
                        }, actualBody.contentTypeAST));
                        if (actualBody.schemaString) {
                            let v = this.ramlCoverage.atl.obtainSchemaValidator(actualBody.schemaString);
                            bodyAsserion.innerAssertions.push(new CoverageAssertion('response.body schema', (results) => {
                                let responses = results.filter(x => x.test.response.status == statusCode
                                    &&
                                        x.test.method.toUpperCase() == methodName
                                    &&
                                        (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0);
                                if (!responses.length)
                                    throw new NoMatchingResults;
                                responses.forEach(x => {
                                    let validationResult = v(x.response.body);
                                    if (!validationResult.valid) {
                                        throw new CoverageError((validationResult.errors && validationResult.errors.map(x => "  " + x.stack)).join('\n') || "Invalid schema");
                                    }
                                });
                            }, actualBody.schema.highLevel().lowLevel()));
                        }
                    });
                    if (response.headers) {
                        let headers = Object.keys(response.headers);
                        headers.forEach(headerKey => {
                            let headerObject = response.headers[headerKey];
                            headerKey = headerKey.toLowerCase();
                            methodAssetions.innerAssertions.push(new CoverageAssertion('response.headers::' + headerKey, (results) => {
                                let responses = results.filter(x => x.test.response.status == statusCode
                                    &&
                                        x.test.method.toUpperCase() == methodName);
                                if (!responses.length)
                                    throw new NoMatchingResults;
                                responses.forEach(x => {
                                    let receivedHeaders = Object.keys(x.response.header).map(x => x.toLowerCase());
                                    if (receivedHeaders.indexOf(headerKey) == -1)
                                        if (headerObject.optional())
                                            throw new OptionalError(headerKey + " header not received (Optional)");
                                        else
                                            throw new CoverageError(headerKey + " header not received");
                                });
                            }, headerObject.highLevel().lowLevel()));
                        });
                    }
                });
            }
        });
    }
    resolve(test, response) {
        this.results.push({
            test: test,
            response: response
        });
    }
    registerCoverageLineOnData(lineData, cov) {
        if (!cov.data[lineData.file]) {
            cov.data[lineData.file] = { source: [] };
            try {
                cov.data[lineData.file] = { source: this.ramlCoverage.atl.options.FSResolver.content(lineData.file).split(/\n/g) };
            }
            catch (e) {
            }
        }
        let data = cov.data[lineData.file];
        if (lineData.line >= 0) {
            while ((lineData.line + 1) > data.source.length) {
                data.source.push(undefined);
            }
        }
        if (lineData.covered) {
            data[lineData.line] = (data[lineData.line] || 0) + 1;
        }
        else {
            data[lineData.line] = data[lineData.line] || 0;
        }
    }
    registerCoverageLine(lineData) {
        this.registerCoverageLineOnData(lineData, this.ramlCoverage.coverageData);
        this.registerCoverageLineOnData(lineData, exports.GlobalCoverageDataCollector);
    }
    getCoverage() {
        let prom = ATLHelpers.flatPromise();
        let total = 0;
        let notCovered = 0;
        let errored = 0;
        let lines = 0;
        const walk = (assertion) => {
            if (assertion.validationFn) {
                total++;
                if (!assertion.valid) {
                    if (assertion.error && (assertion.error instanceof NotImplementedError)) {
                        notCovered++;
                    }
                    else {
                        errored++;
                    }
                }
            }
            let coverageResult = assertion.getCoverage();
            if (coverageResult) {
                this.registerCoverageLine(coverageResult);
                lines += coverageResult.lineEnd - coverageResult.line + 1;
            }
            if (assertion.innerAssertions.length) {
                assertion.innerAssertions.forEach(x => walk(x));
            }
        };
        const calculateCoverage = () => {
            walk(this.resourceAssertion);
            prom.resolver({
                total: total,
                errored: errored,
                notCovered: notCovered
            });
        };
        this.resourceAssertion.promise.promise.then(calculateCoverage).catch(calculateCoverage);
        return prom.promise;
    }
    run() {
        return this.resourceAssertion.validate(this.results);
    }
}
exports.CoverageResource = CoverageResource;
class RAMLCoverage {
    constructor(raml, atl) {
        this.raml = raml;
        this.atl = atl;
        this.coverageElements = [];
        this.coverageData = new CoverageData;
        let resources = raml.expand().resources();
        for (let r in resources) {
            this.peekResource(resources[r]);
        }
    }
    peekResource(resource, parent) {
        let thisUrl = (parent || "") + resource.relativeUri().value();
        this.coverageElements.push(new CoverageResource(resource, this));
        let resources = resource.resources();
        for (let r in resources) {
            this.peekResource(resources[r], thisUrl);
        }
    }
    registerTestResult(test, ctx) {
        this.coverageElements.forEach(coverageElement => {
            let matchPart = url.parse(ctx.url);
            if (coverageElement.matches(matchPart.pathname)) {
                coverageElement.resolve(ctx.test, ctx.res);
            }
        });
    }
    writeCoverage(coverFile) {
        let cwd = path.dirname(coverFile);
        if (this.coverageData && this.coverageData.data && Object.keys(this.coverageData.data).length) {
            console.info("Writing coverage information: " + coverFile);
            let coverage = '';
            try {
                fs.mkdirSync(cwd);
            }
            catch (e) { }
            try {
                coverage = fs.readFileSync(coverFile).toString();
            }
            catch (e) {
            }
            if (coverage.length)
                coverage = coverage + '\n';
            coverage =
                coverage += Object.keys(this.coverageData.data)
                    .filter(x => !!x && !!this.coverageData.data[x])
                    .map((file) => {
                    let data = this.coverageData.data[file];
                    console.info('  Writing ' + file + ' coverage.');
                    return RAMLCoverageReporter_1.generateString(file, data);
                }).join('\n');
            fs.writeFileSync(coverFile, coverage);
            this.coverageData.data = {};
            console.info("Writing coverage information. OK!");
        }
    }
}
exports.RAMLCoverage = RAMLCoverage;
class CoverageError extends Error {
}
exports.CoverageError = CoverageError;
class NotImplementedError extends CoverageError {
    constructor(message) {
        super(message);
        this.message = message;
        this.name = "Method not implemented";
    }
}
exports.NotImplementedError = NotImplementedError;
class OptionalError extends CoverageError {
    constructor(message) {
        super(message);
        this.message = message;
        this.name = "Optional Error";
    }
}
exports.OptionalError = OptionalError;
class NoMatchingResults extends NotImplementedError {
    constructor() {
        super("No matching results");
    }
}
exports.NoMatchingResults = NoMatchingResults;
//# sourceMappingURL=Coverage.js.map