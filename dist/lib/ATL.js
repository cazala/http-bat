"use strict";
var util = require('util');
var ATLHelpers = require('./ATLHelpers');
var _ = require('lodash');
var RAML = require('raml-1-parser');
var jsonschema = require('jsonschema');
var YAML_1 = require('./YAML');
var FileSystem_1 = require('./FileSystem');
var path = require('path');
if (typeof Promise != 'function')
    require('es6-promise').polyfill();
var ATL = (function () {
    function ATL(options) {
        this.options = {
            variables: {},
            path: null,
            file: null,
            selfSignedCert: false,
            raml: {
                coverage: true,
                resourceTypes: true,
                traits: true
            },
            FSResolver: null
        };
        this.suites = {};
        this.schemas = {};
        this.errors = [];
        if (options)
            _.merge(this.options, options);
        if (!this.options.FSResolver)
            this.options.FSResolver = new FileSystem_1.FSResolver(this.options.path);
    }
    ATL.prototype.allTests = function () {
        var tests = [];
        var walk = function (suite) {
            if (suite.test)
                tests.push(suite.test);
            if (suite.suites && Object.keys(suite.suites).length) {
                for (var k in suite.suites)
                    walk(suite.suites[k]);
            }
        };
        for (var suite in this.suites)
            walk(this.suites[suite]);
        return tests;
    };
    ATL.prototype.fromAST = function (astRoot) {
        var _this = this;
        this.options.variables = this.options.variables || {};
        YAML_1.YAMLAstHelpers.iterpretMap(astRoot, ATL.interprete, true, this);
        // override variables.ENV if not exists or is an object
        if (!this.options.variables['ENV'] || typeof this.options.variables['ENV'] != "object")
            this.options.variables['ENV'] = {};
        _.extend(this.options.variables['ENV'], _.cloneDeep(process.env));
        this.allTests().forEach(function (x) { return _this.replaceSchema(x); });
        var requiredSuites = [];
        var lastSyncSuite = null;
        var _loop_1 = function(suiteName) {
            var suite = this_1.suites[suiteName];
            if (suite.async) {
                if (lastSyncSuite) {
                    suite.dependsOn.push(lastSyncSuite);
                }
                requiredSuites.push(suite);
            }
            else {
                requiredSuites.forEach(function (x) {
                    return suite.dependsOn.push(x);
                });
                if (lastSyncSuite)
                    suite.dependsOn.push(lastSyncSuite);
                requiredSuites.length = 0;
                lastSyncSuite = suite;
            }
        };
        var this_1 = this;
        for (var suiteName in this.suites) {
            _loop_1(suiteName);
        }
        YAML_1.walkFindingErrors(astRoot, this.errors);
        return;
    };
    ATL.prototype.obtainSchemaValidator = function (schema) {
        var v = new jsonschema.Validator();
        if (typeof schema == "string") {
            if (schema in this.schemas) {
                v.addSchema(this.schemas[schema], schema);
                schema = this.schemas[schema];
            }
            else {
                try {
                    schema = JSON.parse(schema);
                    v.addSchema(schema);
                }
                catch (e) {
                }
            }
        }
        else if (typeof schema == "object") {
            v.addSchema(schema);
        }
        else {
            throw new Error('Invalid schema ' + util.inspect(schema));
        }
        if (v.unresolvedRefs && v.unresolvedRefs.length) {
            while (v.unresolvedRefs && v.unresolvedRefs.length) {
                var nextSchema = v.unresolvedRefs.shift();
                var theSchema = this.schemas[nextSchema];
                if (!theSchema)
                    throw new Error("schema " + nextSchema + " not found");
                v.addSchema(theSchema, nextSchema);
            }
        }
        return function (content) {
            return v.validate(content, schema);
        };
    };
    // Matches the schemas of the tests against the schemas of the ATL document
    ATL.prototype.replaceSchema = function (test) {
        if (test && test.response.body && test.response.body.schema) {
            if (typeof test.response.body.schema == "string") {
                if (test.response.body.schema in this.schemas) {
                    test.response.body.schema = this.schemas[test.response.body.schema];
                }
                else {
                    new YAML_1.NodeError('schema ' + test.response.body.schema + ' not found on test ' + test.method + ' ' + test.uri, test.response.body.lowLevelNode);
                }
            }
        }
    };
    ATL.prototype._addSchema = function (schemaName, schema) {
        if (schemaName in this.schemas) {
            throw new Error("schemas: duplicated schema " + schemaName);
        }
        this.schemas[schemaName] = schema;
    };
    ATL.interprete = {
        baseUri: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
                var value = YAML_1.YAMLAstHelpers.readScalar(node);
                atl.options.baseUri = value;
                if (atl.options.baseUri.substr(-1) === '/') {
                    atl.options.baseUri = atl.options.baseUri.substr(0, atl.options.baseUri.length - 1);
                }
            }
        },
        raml: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
                var value = YAML_1.YAMLAstHelpers.readScalar(node);
                try {
                    atl.raml = RAML.loadApiSync(value, { rejectOnErrors: true, fsResolver: atl.options.FSResolver });
                }
                catch (e) {
                    if (e.parserErrors) {
                        throw path.resolve(value) + ':\n' + e.message + "\n" + e.parserErrors.map(function (x) { return "  " + x.message + " line " + x.line; }).join("\n");
                    }
                    else {
                        console.log(util.inspect(e));
                    }
                    throw e;
                }
                try {
                    // try to get absoluteUriParameters
                    atl.raml.allResources()[0].absoluteUriParameters().map(function (x) { return x; });
                    atl.raml.allBaseUriParameters().map(function (x) { return x; });
                }
                catch (e) {
                    new YAML_1.NodeError("raml file must have baseUri", node);
                }
                var schemas = atl.raml.schemas();
                for (var i in schemas) {
                    var schemaList = schemas[i].toJSON();
                    for (var schemaName in schemaList) {
                        var json = null;
                        try {
                            json = JSON.parse(schemaList[schemaName]);
                            atl._addSchema(schemaName, json);
                        }
                        catch (e) {
                            e.message = 'Error parsing JSON schema ' + schemaName + '\n\t' + e.message + '\n' + util.inspect(schemaList[schemaName]);
                            throw e;
                        }
                    }
                }
            }
        },
        variables: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var value = YAML_1.YAMLAstHelpers.toObject(node);
                atl.options.variables = _.merge(atl.options.variables || {}, value);
            }
        },
        options: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var options_1 = YAML_1.YAMLAstHelpers.toObject(node);
                Object.keys(options_1).forEach(function (key) {
                    var value = options_1[key];
                    switch (key) {
                        case 'selfSignedCert':
                            ATLHelpers.ensureInstanceOf("options.selfSignedCert", value, Boolean);
                            atl.options.selfSignedCert = !!value;
                            break;
                        case 'raml':
                            ATLHelpers.ensureInstanceOf("options.raml", value, Object);
                            _.merge(atl.options.raml, value);
                            break;
                        default:
                            throw new TypeError("unknown option:" + key);
                    }
                });
            }
        },
        tests: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var tests = YAML_1.YAMLAstHelpers.getMap(node);
                var suite = null;
                for (var sequenceName in tests) {
                    if (YAML_1.YAMLAstHelpers.isMap(tests[sequenceName])) {
                        suite = ATLHelpers.parseSuites(sequenceName, tests[sequenceName], atl);
                        suite.name = sequenceName;
                        atl.suites[suite.name] = suite;
                    }
                    else {
                        new YAML_1.NodeError("suites must be non-empty maps: " + sequenceName, node);
                    }
                }
            }
        },
        schemas: function (atl, node) {
            if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
                var schemas = YAML_1.YAMLAstHelpers.getMap(node);
                if (schemas) {
                    for (var sequenceName in schemas) {
                        var schemaName = null;
                        if (YAML_1.YAMLAstHelpers.isInclude(schemas[sequenceName])) {
                            // load string schema by path
                            var include = YAML_1.YAMLAstHelpers.readInclude(schemas[sequenceName]);
                            var content = include.content(atl.options.FSResolver);
                            try {
                                var schemaBody = JSON.parse(content);
                                // TODO, load schema
                                atl._addSchema(sequenceName, schemaBody);
                            }
                            catch (e) {
                                new YAML_1.NodeError("error adding schema " + sequenceName + ":" + include.path + ". " + e.toString(), schemas[sequenceName]);
                            }
                        }
                        else {
                            new YAML_1.NodeError("schemas: invalid schema " + sequenceName + ", it must be a !include reference", schemas[sequenceName]);
                        }
                    }
                }
            }
        }
    };
    return ATL;
}());
exports.ATL = ATL;
//# sourceMappingURL=ATL.js.map