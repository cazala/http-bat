import util = require('util');

import ATLHelpers = require('./ATLHelpers');
import _ = require('lodash');
import RAML = require('raml-1-parser');
const jsonschema = require('jsonschema');
import { SuperAgent, SuperAgentRequest, agent } from 'superagent';

import { ASTParser, YAMLAstHelpers, NodeError, walkFindingErrors, printError } from './YAML';

import { IFSResolver, FSResolver } from './FileSystem';

import path = require('path');

if (typeof Promise != 'function')
  require('es6-promise').polyfill();

export interface IATLOptions {
  variables?: ATLHelpers.IDictionary<any>;
  path?: string;
  file?: string;
  baseUri?: string;
  baseUriParameters?: ATLHelpers.IDictionary<string>;
  selfSignedCert: boolean;
  raml: {
    coverage: boolean;
    resourceTypes: boolean;
    traits: boolean;
  };
  FSResolver: IFSResolver;
}

export class ATL {

  static interprete = {
    baseUri(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, String)) {
        let value = YAMLAstHelpers.readScalar(node);

        atl.options.baseUri = value;

        if (atl.options.baseUri.substr(-1) === '/') {
          atl.options.baseUri = atl.options.baseUri.substr(0, atl.options.baseUri.length - 1);
        }
      }
    },
    raml(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, String)) {
        let value = YAMLAstHelpers.readScalar(node);

        try {
          atl.raml = RAML.loadApiSync(value, { rejectOnErrors: true, fsResolver: atl.options.FSResolver });
        } catch (e) {
          if (e.parserErrors) {
            throw path.resolve(value) + ':\n' + e.message + "\n" + e.parserErrors.map(x => "  " + x.message + " line " + x.line).join("\n");
          } else {
            console.log(util.inspect(e));
          }
          throw e;
        }
        try {
          // try to get absoluteUriParameters
          (atl.raml.allResources()[0].absoluteUriParameters() as Array<any>).map(x => x);

          (atl.raml.allBaseUriParameters() as Array<any>).map(x => x);
        } catch (e) {
          new NodeError("raml file must have baseUri", node);
        }


        let schemas = atl.raml.schemas();

        for (let i in schemas) {
          let schemaList = schemas[i].toJSON();
          for (let schemaName in schemaList) {
            let json = null;
            try {
              json = JSON.parse(schemaList[schemaName]);
              atl._addSchema(schemaName, json);
            } catch (e) {
              e.message = 'Error parsing JSON schema ' + schemaName + '\n\t' + e.message + '\n' + util.inspect(schemaList[schemaName]);
              throw e;
            }
          }
        }
      }
    },
    variables(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {

        let value = YAMLAstHelpers.toObject(node);

        atl.options.variables = _.merge(atl.options.variables || {}, value);
      }
    },
    options(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {

        let options = YAMLAstHelpers.toObject(node);

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
    tests(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {

        let tests = YAMLAstHelpers.getMap(node);

        let suite: ATLHelpers.ATLSuite = null;

        for (let sequenceName in tests) {
          if (YAMLAstHelpers.isMap(tests[sequenceName])) {
            suite = ATLHelpers.parseSuites(sequenceName, tests[sequenceName], atl);
            suite.name = sequenceName;

            atl.suites[suite.name] = suite;
          } else {
            new NodeError("suites must be non-empty maps: " + sequenceName, node);
          }
        }
      }
    },
    schemas(atl: ATL, node: ASTParser.YAMLNode) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {

        let schemas = YAMLAstHelpers.getMap(node);

        if (schemas) {
          for (let sequenceName in schemas) {
            let schemaName: string = null;

            if (YAMLAstHelpers.isInclude(schemas[sequenceName])) {
              // load string schema by path
              let include = YAMLAstHelpers.readInclude(schemas[sequenceName]);

              let content = include.content(atl.options.FSResolver);
              try {
                let schemaBody = JSON.parse(content);
                // TODO, load schema
                atl._addSchema(sequenceName, schemaBody);
              } catch (e) {
                new NodeError("error adding schema " + sequenceName + ":" + include.path + ". " + e.toString(), schemas[sequenceName]);
              }
            } else {
              new NodeError("schemas: invalid schema " + sequenceName + ", it must be a !include reference", schemas[sequenceName]);
            }
          }
        }
      }
    }
  };

  options: IATLOptions = {
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

  constructor(options?: IATLOptions) {
    if (options)
      _.merge(this.options, options);

    if (!this.options.FSResolver)
      this.options.FSResolver = new FSResolver(this.options.path);
  }

  agent: SuperAgent<SuperAgentRequest>;

  raml: RAML.api08.Api | RAML.api10.Api;

  suites: ATLHelpers.IDictionary<ATLHelpers.ATLSuite> = {};

  schemas: ATLHelpers.IDictionary<any> = {};

  errors = [];


  allTests(): ATLHelpers.ATLTest[] {
    let tests = [];

    const walk = (suite: ATLHelpers.ATLSuite) => {
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

  fromAST(astRoot: ASTParser.YAMLNode) {
    this.options.variables = this.options.variables || {};

    YAMLAstHelpers.iterpretMap(astRoot, ATL.interprete, true, this);

    // override variables.ENV if not exists or is an object
    if (!this.options.variables['ENV'] || typeof this.options.variables['ENV'] != "object")
      this.options.variables['ENV'] = {};

    _.extend(this.options.variables['ENV'], _.cloneDeep(process.env));

    this.allTests().forEach(x => this.replaceSchema(x));

    let requiredSuites: ATLHelpers.ATLSuite[] = [];

    let lastSyncSuite: ATLHelpers.ATLSuite = null;

    for (let suiteName in this.suites) {
      let suite = this.suites[suiteName];

      if (suite.async) {
        if (lastSyncSuite) {
          suite.dependsOn.push(lastSyncSuite);
        }

        requiredSuites.push(suite);
      } else {
        requiredSuites.forEach(x =>
          suite.dependsOn.push(x)
        );

        if (lastSyncSuite)
          suite.dependsOn.push(lastSyncSuite);

        requiredSuites.length = 0;

        lastSyncSuite = suite;
      }
    }

    walkFindingErrors(astRoot, this.errors);

    return;
  }

  obtainSchemaValidator(schema: any) {
    let v = new jsonschema.Validator();

    if (typeof schema == "string") {
      if (schema in this.schemas) {
        v.addSchema(this.schemas[schema], schema);
        schema = this.schemas[schema];
      } else {
        try {
          schema = JSON.parse(schema);
          v.addSchema(schema);
        } catch (e) {

        }
      }
    } else if (typeof schema == "object") {
      v.addSchema(schema);
    } else {
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

    return (content): { valid: boolean; errors: any[]; } => {
      return v.validate(content, schema);
    };
  }

  // Matches the schemas of the tests against the schemas of the ATL document
  private replaceSchema(test: ATLHelpers.ATLTest) {
    if (test && test.response.body && test.response.body.schema) {
      if (typeof test.response.body.schema == "string") {
        if (test.response.body.schema in this.schemas) {
          test.response.body.schema = this.schemas[test.response.body.schema];
        } else {
          new NodeError('schema ' + test.response.body.schema + ' not found on test ' + test.method + ' ' + test.uri, test.response.body.lowLevelNode);
        }
      }
    }
  }

  private _addSchema(schemaName: string, schema: any) {
    if (schemaName in this.schemas) {
      throw new Error("schemas: duplicated schema " + schemaName);
    }

    this.schemas[schemaName] = schema;
  }
}