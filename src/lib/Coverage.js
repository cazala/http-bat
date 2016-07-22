"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// Node
var fs = require('fs');
var path = require('path');
var url = require('url');
var util = require('util');
var _ = require('lodash');
var jsonschema = require('jsonschema');
var pathMatch = require('raml-path-match');
var ATLHelpers = require('./ATLHelpers');
var RAMLCoverageReporter_1 = require('../lib/RAMLCoverageReporter');
var CoverageData = (function () {
    function CoverageData() {
        this.data = {};
    }
    return CoverageData;
}());
exports.CoverageData = CoverageData;
exports.GlobalCoverageDataCollector = new CoverageData();
var theGlobalObject = global;
theGlobalObject._$jscoverage = exports.GlobalCoverageDataCollector.data;
theGlobalObject._$jscoverage = exports.GlobalCoverageDataCollector.data;
var CoverageAssertion = (function () {
    function CoverageAssertion(name, validationFn, lowLevelAST) {
        var _this = this;
        this.name = name;
        this.validationFn = validationFn;
        this.lowLevelAST = lowLevelAST;
        this.valid = null;
        this.innerAssertions = [];
        /// Resolves when the validation is OK
        this.promise = ATLHelpers.flatPromise();
        this.promise.promise
            .then(function (x) {
            if (x) {
                _this.error = x;
                _this.valid = false;
                return Promise.reject(x);
            }
            else {
                delete _this.error;
                _this.valid = true;
                return Promise.resolve();
            }
        })
            .catch(function (x) {
            _this.error = x;
            _this.valid = false;
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
    CoverageAssertion.prototype.getCoverage = function () {
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
    };
    CoverageAssertion.prototype.validate = function (res) {
        var _this = this;
        var waitForInner = Promise.resolve();
        try {
            if (!res || !res.length) {
                throw new NoMatchingResults;
            }
            if (this.validationFn) {
                var actualResult = this.validationFn(res);
                if (actualResult) {
                    if (!(actualResult instanceof Promise)) {
                        this.promise.rejecter(new Error(this.name + " does not return a Promise, got " + util.inspect(actualResult)));
                    }
                    else {
                        actualResult
                            .then(function (result) {
                            if (result) {
                                _this.promise.rejecter(result);
                            }
                            else {
                                _this.promise.resolver();
                            }
                        })
                            .catch(function (err) {
                            _this.promise.rejecter(err);
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
            waitForInner = Promise.all(this.innerAssertions.map(function (x) { return x.validate(res); }));
        }
        // THIS METOD MUST RESOLVE EVERY TIME
        return this.promise.promise
            .then(function (error) { return waitForInner.then(function () { return error; }); })
            .catch(function (error) { return waitForInner.then(function () { return Promise.resolve(error); }); });
    };
    return CoverageAssertion;
}());
exports.CoverageAssertion = CoverageAssertion;
var CoverageResource = (function () {
    function CoverageResource(resource, ramlCoverage) {
        this.resource = resource;
        this.ramlCoverage = ramlCoverage;
        this.results = [];
        this.coverageTree = {};
        this.resourceJSON = null;
        this.uriParameters = [];
        this.relativeUrl = resource.completeRelativeUri();
        try {
            this.uriParameters = resource.absoluteUriParameters().map(function (x) { return x.toJSON(); });
        }
        catch (e) {
        }
        this.matches = pathMatch(this.relativeUrl, this.uriParameters);
        this.generateAssertions();
    }
    CoverageResource.prototype.generateAssertions = function () {
        var _this = this;
        this.resourceAssertion = new CoverageAssertion(this.resource.completeRelativeUri());
        var methods = [];
        var type = this.resource.type();
        methods = methods.concat(this.resource.methods());
        methods.forEach(function (method) {
            var methodName = method.method().toUpperCase();
            var methodJson = method.toJSON();
            var methodAssetions = new CoverageAssertion(methodName, null, method.highLevel().lowLevel());
            _this.resourceAssertion.innerAssertions.push(methodAssetions);
            var responses = [];
            var flatQueryParameters = {};
            // if (this.bat.ast.options.raml.traits) {
            var traits = method.is();
            for (var traitIndex = 0; traitIndex < traits.length; traitIndex++) {
                var trait = traits[traitIndex];
                var traitJSON = trait.trait().toJSON();
                var traitName = trait.name();
                if (traitJSON[traitName].queryParameters) {
                    for (var name_1 in traitJSON[traitName].queryParameters) {
                        var param = traitJSON[traitName].queryParameters[name_1];
                        flatQueryParameters[param.name] = flatQueryParameters[param.name] || {};
                        _.merge(flatQueryParameters[param.name], param);
                    }
                }
                responses = responses.concat(trait.trait().responses());
            }
            // }
            // if (this.bat.ast.options.raml.resourceTypes) {
            if (type) {
                var typeMethods = type.resourceType().methods();
                typeMethods = typeMethods.filter(function (x) { return x.method().toUpperCase() == method.method().toUpperCase(); });
                typeMethods.forEach(function (m) {
                    var typeMethodJson = m.toJSON()[m.method().toLowerCase()];
                    if (typeMethodJson.queryParameters) {
                        for (var name_2 in typeMethodJson.queryParameters) {
                            var param = typeMethodJson.queryParameters[name_2];
                            flatQueryParameters[param.name] = flatQueryParameters[param.name] || {};
                            _.merge(flatQueryParameters[param.name], param);
                        }
                    }
                    responses = responses.concat(m.responses());
                });
            }
            // }
            responses = responses.concat(method.responses());
            var flatResponses = {};
            responses.forEach(function (x) {
                var key = x.code().value();
                var flatResponse = flatResponses[key] = flatResponses[key] || {};
                flatResponse.status = key;
                flatResponse.statusAST = x.code().highLevel().lowLevel();
                x.headers().forEach(function (h) {
                    flatResponse.headers = flatResponse.headers || {};
                    flatResponse.headers[h.name()] = h || flatResponse.headers[h.name()];
                });
                flatResponse.bodies = {};
                x.body().forEach(function (h) {
                    var contentType = h.name();
                    var body = flatResponse.bodies[contentType] = flatResponse.bodies[contentType] || {
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
                    .map(function (key) { return flatQueryParameters[key]; })
                    .forEach(function (qp) {
                    methodAssetions.innerAssertions.push(new CoverageAssertion('request.queryParameter::' + qp.name + ' must be present on some call', function (results) {
                        if (!results.some(function (x) {
                            return x.test.method.toUpperCase() == methodName
                                &&
                                    (qp.name in x.test.requester.urlObject.query);
                        }))
                            throw new (qp.required ? Error : NotImplementedError)("Query parameter not covered. Found permutations: " + util.inspect(results.map(function (x) { return x.test.requester.urlObject.query; })));
                    }));
                    methodAssetions.innerAssertions.push(new CoverageAssertion('request.queryParameter::' + qp.name + ' must not be present on some call', function (results) {
                        if (!results.some(function (x) {
                            return x.test.method.toUpperCase() == methodName
                                &&
                                    !(qp.name in x.test.requester.urlObject.query);
                        }))
                            throw new NotImplementedError("Missing queryParameter not covered. Found permutations: " + util.inspect(results.map(function (x) { return x.test.requester.urlObject.query; })));
                    }));
                });
            }
            if (responses.length == 0) {
                methodAssetions.innerAssertions.push(new CoverageAssertion('should have been called', function (results) {
                    if (!results.some(function (x) { return x.test.method.toUpperCase() == methodName; }))
                        throw new NoMatchingResults;
                }));
            }
            else {
                Object.keys(flatResponses).map(function (x) { return parseInt(x); }).forEach(function (statusCode) {
                    var response = flatResponses[statusCode];
                    methodAssetions.innerAssertions.push(new CoverageAssertion('check ' + statusCode + ' response', function (results) {
                        var responses = results.filter(function (x) {
                            return x.test.response.status == statusCode
                                &&
                                    x.test.method.toUpperCase() == methodName;
                        });
                        if (!responses.length) {
                            throw new NotImplementedError('status code ' + statusCode + ' not covered');
                        }
                        else {
                            responses.forEach(function (x) {
                                if (x.response.status != statusCode)
                                    throw new CoverageError('unexpected response.status: ' + x.response.status);
                            });
                        }
                    }, response.statusAST));
                    var allBodies = Object.keys(response.bodies);
                    var responseAssertion = new CoverageAssertion(statusCode.toString());
                    methodAssetions.innerAssertions.push(responseAssertion);
                    allBodies.forEach(function (contentType) {
                        var bodyAsserion = new CoverageAssertion(contentType);
                        var actualBody = response.bodies[contentType];
                        responseAssertion.innerAssertions.push(bodyAsserion);
                        bodyAsserion.innerAssertions.push(new CoverageAssertion('response.headers::content-type == ' + contentType, function (results) {
                            var responses = results.filter(function (x) {
                                return x.test.response.status == statusCode
                                    &&
                                        x.test.method.toUpperCase() == methodName;
                            });
                            if (!responses.length) {
                                throw new NotImplementedError('status code ' + statusCode + ' not covered');
                            }
                            var withHeader = responses.filter(function (x) {
                                return (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0;
                            });
                            if (!withHeader.length) {
                                throw new NotImplementedError('content-type "' + contentType + '" not covered, covered cases: [ '
                                    + (responses.filter(function (x) { return x.test.request.headers && x.test.request.headers['content-type']; }).map(function (x) { return x.test.request.headers['content-type']; }).join(' | ') || 'NONE')
                                    + ' ] received [ ' + responses.map(function (x) { return x.response.get('content-type') || 'undefined'; }) + ' ]');
                            }
                        }, actualBody.contentTypeAST));
                        if (actualBody.schemaString) {
                            var v_1 = _this.ramlCoverage.atl.obtainSchemaValidator(actualBody.schemaString);
                            bodyAsserion.innerAssertions.push(new CoverageAssertion('response.body schema', function (results) {
                                var responses = results.filter(function (x) {
                                    return x.test.response.status == statusCode
                                        &&
                                            x.test.method.toUpperCase() == methodName
                                        &&
                                            (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0;
                                });
                                if (!responses.length)
                                    throw new NoMatchingResults;
                                responses.forEach(function (x) {
                                    var validationResult = v_1(x.response.body);
                                    if (!validationResult.valid) {
                                        throw new CoverageError((validationResult.errors && validationResult.errors.map(function (x) { return "  " + x.stack; })).join('\n') || "Invalid schema");
                                    }
                                });
                            }, actualBody.schema.highLevel().lowLevel()));
                        }
                    });
                    if (response.headers) {
                        var headers = Object.keys(response.headers);
                        headers.forEach(function (headerKey) {
                            var headerObject = response.headers[headerKey];
                            headerKey = headerKey.toLowerCase();
                            methodAssetions.innerAssertions.push(new CoverageAssertion('response.headers::' + headerKey, function (results) {
                                var responses = results.filter(function (x) {
                                    return x.test.response.status == statusCode
                                        &&
                                            x.test.method.toUpperCase() == methodName;
                                });
                                if (!responses.length)
                                    throw new NoMatchingResults;
                                responses.forEach(function (x) {
                                    var receivedHeaders = Object.keys(x.response.header).map(function (x) { return x.toLowerCase(); });
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
    };
    CoverageResource.prototype.resolve = function (test, response) {
        this.results.push({
            test: test,
            response: response
        });
    };
    CoverageResource.prototype.registerCoverageLineOnData = function (lineData, cov) {
        if (!cov.data[lineData.file]) {
            cov.data[lineData.file] = { source: [] };
            try {
                cov.data[lineData.file] = { source: this.ramlCoverage.atl.options.FSResolver.content(lineData.file).split(/\n/g) };
            }
            catch (e) {
            }
        }
        var data = cov.data[lineData.file];
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
    };
    CoverageResource.prototype.registerCoverageLine = function (lineData) {
        this.registerCoverageLineOnData(lineData, this.ramlCoverage.coverageData);
        this.registerCoverageLineOnData(lineData, exports.GlobalCoverageDataCollector);
    };
    CoverageResource.prototype.getCoverage = function () {
        var _this = this;
        var prom = ATLHelpers.flatPromise();
        var total = 0;
        var notCovered = 0;
        var errored = 0;
        var lines = 0;
        var walk = function (assertion) {
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
            var coverageResult = assertion.getCoverage();
            if (coverageResult) {
                _this.registerCoverageLine(coverageResult);
                lines += coverageResult.lineEnd - coverageResult.line + 1;
            }
            if (assertion.innerAssertions.length) {
                assertion.innerAssertions.forEach(function (x) { return walk(x); });
            }
        };
        var calculateCoverage = function () {
            walk(_this.resourceAssertion);
            prom.resolver({
                total: total,
                errored: errored,
                notCovered: notCovered
            });
        };
        this.resourceAssertion.promise.promise.then(calculateCoverage).catch(calculateCoverage);
        return prom.promise;
    };
    CoverageResource.prototype.run = function () {
        return this.resourceAssertion.validate(this.results);
    };
    return CoverageResource;
}());
exports.CoverageResource = CoverageResource;
var RAMLCoverage = (function () {
    function RAMLCoverage(raml, atl) {
        this.raml = raml;
        this.atl = atl;
        this.coverageElements = [];
        this.coverageData = new CoverageData;
        var resources = raml.expand().resources();
        for (var r in resources) {
            this.peekResource(resources[r]);
        }
    }
    RAMLCoverage.prototype.peekResource = function (resource, parent) {
        var thisUrl = (parent || "") + resource.relativeUri().value();
        this.coverageElements.push(new CoverageResource(resource, this));
        var resources = resource.resources();
        for (var r in resources) {
            this.peekResource(resources[r], thisUrl);
        }
    };
    RAMLCoverage.prototype.registerTestResult = function (test, ctx) {
        this.coverageElements.forEach(function (coverageElement) {
            var matchPart = url.parse(ctx.url);
            if (coverageElement.matches(matchPart.pathname)) {
                coverageElement.resolve(ctx.test, ctx.res);
            }
        });
    };
    RAMLCoverage.prototype.writeCoverage = function (coverFile) {
        var _this = this;
        var cwd = path.dirname(coverFile);
        if (this.coverageData && this.coverageData.data && Object.keys(this.coverageData.data).length) {
            console.info("Writing coverage information: " + coverFile);
            var coverage = '';
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
                    .filter(function (x) { return !!x && !!_this.coverageData.data[x]; })
                    .map(function (file) {
                    var data = _this.coverageData.data[file];
                    console.info('  Writing ' + file + ' coverage.');
                    return RAMLCoverageReporter_1.generateString(file, data);
                }).join('\n');
            fs.writeFileSync(coverFile, coverage);
            this.coverageData.data = {};
            console.info("Writing coverage information. OK!");
        }
    };
    return RAMLCoverage;
}());
exports.RAMLCoverage = RAMLCoverage;
var CoverageError = (function (_super) {
    __extends(CoverageError, _super);
    function CoverageError() {
        _super.apply(this, arguments);
    }
    return CoverageError;
}(Error));
exports.CoverageError = CoverageError;
var NotImplementedError = (function (_super) {
    __extends(NotImplementedError, _super);
    function NotImplementedError(message) {
        _super.call(this, message);
        this.message = message;
        this.name = "Method not implemented";
    }
    return NotImplementedError;
}(CoverageError));
exports.NotImplementedError = NotImplementedError;
var OptionalError = (function (_super) {
    __extends(OptionalError, _super);
    function OptionalError(message) {
        _super.call(this, message);
        this.message = message;
        this.name = "Optional Error";
    }
    return OptionalError;
}(CoverageError));
exports.OptionalError = OptionalError;
var NoMatchingResults = (function (_super) {
    __extends(NoMatchingResults, _super);
    function NoMatchingResults() {
        _super.call(this, "No matching results");
    }
    return NoMatchingResults;
}(NotImplementedError));
exports.NoMatchingResults = NoMatchingResults;
//# sourceMappingURL=Coverage.js.map