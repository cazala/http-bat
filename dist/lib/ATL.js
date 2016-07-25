"use strict";
const util = require('util');
const ATLHelpers = require('./ATLHelpers');
const _ = require('lodash');
const RAML = require('raml-1-parser');
const jsonschema = require('jsonschema');
const YAML_1 = require('./YAML');
const FileSystem_1 = require('./FileSystem');
const path = require('path');
if (typeof Promise != 'function')
    require('es6-promise').polyfill();
class ATL {
    constructor(options) {
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
    allTests() {
        let tests = [];
        const walk = (suite) => {
            if (suite.test)
                tests.push(suite.test);
            if (suite.suites && Object.keys(suite.suites).length) {
                for (let k in suite.suites)
                    walk(suite.suites[k]);
            }
        };
        for (let suite in this.suites)
            walk(this.suites[suite]);
        return tests;
    }
    fromAST(astRoot) {
        this.options.variables = this.options.variables || {};
        YAML_1.YAMLAstHelpers.iterpretMap(astRoot, ATL.interprete, true, this);
        // override variables.ENV if not exists or is an object
        if (!this.options.variables['ENV'] || typeof this.options.variables['ENV'] != "object")
            this.options.variables['ENV'] = {};
        if (this.options.variables['ENV']) {
            let clonedEnv = _.cloneDeep(process.env);
            Object.keys(this.options.variables['ENV']).forEach(key => {
                this.options.variables['ENV'][key] = clonedEnv[key] || this.options.variables['ENV'][key];
            });
        }
        this.allTests().forEach(x => this.replaceSchema(x));
        let requiredSuites = [];
        let lastSyncSuite = null;
        for (let suiteName in this.suites) {
            let suite = this.suites[suiteName];
            if (suite.async) {
                if (lastSyncSuite) {
                    suite.dependsOn.push(lastSyncSuite);
                }
                requiredSuites.push(suite);
            }
            else {
                requiredSuites.forEach(x => suite.dependsOn.push(x));
                if (lastSyncSuite)
                    suite.dependsOn.push(lastSyncSuite);
                requiredSuites.length = 0;
                lastSyncSuite = suite;
            }
        }
        YAML_1.walkFindingErrors(astRoot, this.errors);
        return;
    }
    obtainSchemaValidator(schema) {
        let v = new jsonschema.Validator();
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
                let nextSchema = v.unresolvedRefs.shift();
                let theSchema = this.schemas[nextSchema];
                if (!theSchema)
                    throw new Error("schema " + nextSchema + " not found");
                v.addSchema(theSchema, nextSchema);
            }
        }
        return (content) => {
            return v.validate(content, schema);
        };
    }
    // Matches the schemas of the tests against the schemas of the ATL document
    replaceSchema(test) {
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
    }
    _addSchema(schemaName, schema) {
        if (schemaName in this.schemas) {
            throw new Error("schemas: duplicated schema " + schemaName);
        }
        this.schemas[schemaName] = schema;
    }
}
ATL.interprete = {
    baseUri(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            atl.options.baseUri = value;
            if (atl.options.baseUri.substr(-1) === '/') {
                atl.options.baseUri = atl.options.baseUri.substr(0, atl.options.baseUri.length - 1);
            }
        }
    },
    raml(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, String)) {
            let value = YAML_1.YAMLAstHelpers.readScalar(node);
            try {
                atl.raml = RAML.loadApiSync(value, { rejectOnErrors: true, fsResolver: atl.options.FSResolver });
            }
            catch (e) {
                if (e.parserErrors) {
                    throw path.resolve(value) + ':\n' + e.message + "\n" + e.parserErrors.map(x => "  " + x.message + " line " + x.line).join("\n");
                }
                else {
                    console.log(util.inspect(e));
                }
                throw e;
            }
            try {
                // try to get absoluteUriParameters
                atl.raml.allResources()[0].absoluteUriParameters().map(x => x);
                atl.raml.allBaseUriParameters().map(x => x);
            }
            catch (e) {
                new YAML_1.NodeError("raml file must have baseUri", node);
            }
            let schemas = atl.raml.schemas();
            for (let i in schemas) {
                let schemaList = schemas[i].toJSON();
                for (let schemaName in schemaList) {
                    let json = null;
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
    variables(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let value = YAML_1.YAMLAstHelpers.toObject(node);
            atl.options.variables = _.merge(atl.options.variables || {}, value);
        }
    },
    options(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let options = YAML_1.YAMLAstHelpers.toObject(node);
            Object.keys(options).forEach(key => {
                let value = options[key];
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
    tests(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let tests = YAML_1.YAMLAstHelpers.getMap(node);
            let suite = null;
            for (let sequenceName in tests) {
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
    schemas(atl, node) {
        if (YAML_1.YAMLAstHelpers.ensureInstanceOf(node, Object)) {
            let schemas = YAML_1.YAMLAstHelpers.getMap(node);
            if (schemas) {
                for (let sequenceName in schemas) {
                    let schemaName = null;
                    if (YAML_1.YAMLAstHelpers.isInclude(schemas[sequenceName])) {
                        // load string schema by path
                        let include = YAML_1.YAMLAstHelpers.readInclude(schemas[sequenceName]);
                        let content = include.content(atl.options.FSResolver);
                        try {
                            let schemaBody = JSON.parse(content);
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
exports.ATL = ATL;
//# sourceMappingURL=ATL.js.map