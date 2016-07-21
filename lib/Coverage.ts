// Node
import fs = require('fs');
import path = require('path');
import url = require('url');
import util = require('util');

// NPM
import jsYaml = require('js-yaml');
import _ = require('lodash');
import request = require('supertest');
import expect = require('expect');
import RAML = require('raml-1-parser');
const jsonschema = require('jsonschema');
const pathMatch = require('raml-path-match');
import superAgent = require('superagent');

// Locals
import { ATL } from './ATL';
import ATLHelpers = require('./ATLHelpers');
import { generateString as coverageToString } from '../lib/RAMLCoverageReporter';
import { Bat } from './bat';

export interface ITestResult {
  test: ATLHelpers.ATLTest;
  response: request.Response;
}

export interface ICovData {
  [x: number]: number | void;
  source: string[];
}


export class CoverageData {
  data: ATLHelpers.IDictionary<ICovData> = {};
}

export const GlobalCoverageDataCollector = new CoverageData();

let theGlobalObject: any = global;
theGlobalObject._$jscoverage = GlobalCoverageDataCollector.data;
theGlobalObject._$jscoverage = GlobalCoverageDataCollector.data;


export class CoverageAssertion {

  error: Error;
  valid: boolean = null;
  innerAssertions: CoverageAssertion[] = [];

  /// Resolves when the validation is OK
  promise = ATLHelpers.flatPromise();

  src_file: string;
  src_line: number;
  src_line_end: number;
  src_start: number;
  src_end: number;

  constructor(public name: string, public validationFn?: (res: ITestResult[]) => Promise<any> | void, private lowLevelAST?: RAML.ll.ILowLevelASTNode) {
    this.promise.promise
      .then(x => {
        if (x) {
          this.error = x;
          this.valid = false;
          return Promise.reject(x);
        } else {
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
      // console.log(name, this.src_file + '#' + (this.src_line + 1) + ' to ' + (this.src_line_end + 1));
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

  validate(res: ITestResult[]): Promise<any> {

    let waitForInner: Promise<any> = Promise.resolve();


    try {
      if (!res || !res.length) {
        throw new NoMatchingResults;
      }

      if (this.validationFn) {
        let actualResult = this.validationFn(res) as any;

        if (actualResult) {
          if (!(actualResult instanceof Promise)) {
            this.promise.rejecter(new Error(this.name + " does not return a Promise, got " + util.inspect(actualResult)));
          } else {
            actualResult
              .then(result => {
                if (result) {
                  this.promise.rejecter(result);
                } else {
                  this.promise.resolver();
                }
              })
              .catch(err => {
                this.promise.rejecter(err);
              });
          }
        } else {
          this.promise.resolver();
        }
      } else {
        this.promise.resolver();
      }
    } catch (e) {
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

export class CoverageResource {
  relativeUrl: string;
  matches: (str: string) => boolean | any;

  results: ITestResult[] = [];

  coverageTree: ATLHelpers.IDictionary<any> = {};

  resourceJSON = null;

  uriParameters: any[] = [];

  constructor(public resource: RAML.api08.Resource, public ramlCoverage: RAMLCoverage) {
    this.relativeUrl = resource.completeRelativeUri();

    try {
      this.uriParameters = resource.absoluteUriParameters().map(x => x.toJSON());
    } catch (e) {
      // https://github.com/raml-org/raml-js-parser-2/issues/370
    }

    this.matches = pathMatch(this.relativeUrl, this.uriParameters);
    this.generateAssertions();
  }

  resourceAssertion: CoverageAssertion;

  private generateAssertions() {

    this.resourceAssertion = new CoverageAssertion(this.resource.completeRelativeUri());

    let methods = [];

    let type = this.resource.type();

    methods = methods.concat(this.resource.methods());

    methods.forEach(method => {
      let methodName = method.method().toUpperCase();
      let methodJson = method.toJSON();
      let methodAssetions = new CoverageAssertion(methodName, null, method.highLevel().lowLevel());

      this.resourceAssertion.innerAssertions.push(methodAssetions);

      let responses: RAML.api08.Response[] = [];
      let flatQueryParameters: ATLHelpers.IDictionary<any> = {};

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

        responses = responses.concat(trait.trait().responses() as any);
      }
      // }

      // if (this.bat.ast.options.raml.resourceTypes) {
      if (type) {
        let typeMethods = type.resourceType().methods() as RAML.api08.Method[];

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

          responses = responses.concat(m.responses() as any);
        });
      }
      // }


      responses = responses.concat(method.responses() as any);

      let flatResponses: ATLHelpers.IDictionary<{
        status?: string;
        statusAST?: RAML.ll.ILowLevelASTNode;
        headers?: ATLHelpers.IDictionary<RAML.api08.Parameter>;
        bodies?: ATLHelpers.IDictionary<{
          contentType?: string;
          contentTypeAST?: RAML.ll.ILowLevelASTNode;
          schema?: RAML.api08.SchemaString;
          schemaString?: string;
        }>;
      }> = {};

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
            contentType
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
            methodAssetions.innerAssertions.push(
              new CoverageAssertion('request.queryParameter::' + qp.name + ' must be present on some call', (results) => {
                if (!results.some(
                  x =>
                    x.test.method.toUpperCase() == methodName
                    &&
                    (qp.name in x.test.requester.urlObject.query)
                ))
                  throw new (qp.required ? Error : NotImplementedError)("Query parameter not covered. Found permutations: " + util.inspect(results.map(x => x.test.requester.urlObject.query)));
              }));

            methodAssetions.innerAssertions.push(
              new CoverageAssertion('request.queryParameter::' + qp.name + ' must not be present on some call', (results) => {
                if (!results.some(
                  x =>
                    x.test.method.toUpperCase() == methodName
                    &&
                    !(qp.name in x.test.requester.urlObject.query)
                ))
                  throw new NotImplementedError("Missing queryParameter not covered. Found permutations: " + util.inspect(results.map(x => x.test.requester.urlObject.query)));
              }));
          });
      }

      if (responses.length == 0) {
        methodAssetions.innerAssertions.push(new CoverageAssertion('should have been called', (results) => {
          if (!results.some(
            x => x.test.method.toUpperCase() == methodName
          ))
            throw new NoMatchingResults;
        }));
      } else {
        Object.keys(flatResponses).map(x => parseInt(x)).forEach(statusCode => {
          let response = flatResponses[statusCode];

          methodAssetions.innerAssertions.push(
            new CoverageAssertion('check ' + statusCode + ' response', (results) => {
              let responses = results.filter(x =>
                x.test.response.status == statusCode
                &&
                x.test.method.toUpperCase() == methodName
              );

              if (!responses.length) {
                throw new NotImplementedError('status code ' + statusCode + ' not covered');
              } else {
                responses.forEach(x => {
                  if (x.response.status != statusCode)
                    throw new CoverageError('unexpected response.status: ' + x.response.status);
                });
              }
            }, response.statusAST)
          );

          let allBodies = Object.keys(response.bodies);

          let responseAssertion = new CoverageAssertion(statusCode.toString());

          methodAssetions.innerAssertions.push(responseAssertion);

          allBodies.forEach(contentType => {

            let bodyAsserion = new CoverageAssertion(contentType);

            let actualBody = response.bodies[contentType];

            responseAssertion.innerAssertions.push(bodyAsserion);

            bodyAsserion.innerAssertions.push(
              new CoverageAssertion('response.headers::content-type == ' + contentType, (results) => {
                let responses = results.filter(x =>
                  x.test.response.status == statusCode
                  &&
                  x.test.method.toUpperCase() == methodName
                );

                if (!responses.length) {
                  throw new NotImplementedError('status code ' + statusCode + ' not covered');
                }

                let withHeader = responses.filter(x =>
                  (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0
                );

                if (!withHeader.length) {
                  throw new NotImplementedError(
                    'content-type "' + contentType + '" not covered, covered cases: [ '
                    + (responses.filter(x => x.test.request.headers && x.test.request.headers['content-type']).map(x => x.test.request.headers['content-type']).join(' | ') || 'NONE')
                    + ' ] received [ ' + responses.map(x => x.response.get('content-type') || 'undefined') + ' ]'
                  );
                }
              }, actualBody.contentTypeAST)
            );

            if (actualBody.schemaString) {
              let v = this.ramlCoverage.atl.obtainSchemaValidator(actualBody.schemaString);

              bodyAsserion.innerAssertions.push(
                new CoverageAssertion('response.body schema', (results) => {
                  let responses = results.filter(x =>
                    x.test.response.status == statusCode
                    &&
                    x.test.method.toUpperCase() == methodName
                    &&
                    (x.response.get('content-type') || '').toLowerCase().indexOf(contentType.toLowerCase()) == 0
                  );

                  if (!responses.length)
                    throw new NoMatchingResults;

                  responses.forEach(x => {
                    let validationResult = v(x.response.body);

                    if (!validationResult.valid) {
                      throw new CoverageError((validationResult.errors && validationResult.errors.map(x => "  " + x.stack)).join('\n') || "Invalid schema");
                    }
                  });
                }, actualBody.schema.highLevel().lowLevel())
              );
            }
          });

          if (response.headers) {
            let headers = Object.keys(response.headers);

            headers.forEach(headerKey => {
              let headerObject: RAML.api08.Parameter = response.headers[headerKey];

              headerKey = headerKey.toLowerCase();

              methodAssetions.innerAssertions.push(
                new CoverageAssertion('response.headers::' + headerKey, (results) => {
                  let responses = results.filter(x =>
                    x.test.response.status == statusCode
                    &&
                    x.test.method.toUpperCase() == methodName
                  );

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
                }, headerObject.highLevel().lowLevel())
              );
            });
          }
        });
      }
    });
  }


  resolve(test: ATLHelpers.ATLTest, response: request.Response) {
    this.results.push({
      test,
      response
    });
  }


  registerCoverageLineOnData(lineData: {
    file: string;
    line: number;
    lineEnd: number;
    start: number;
    end: number;
    covered: boolean;
  }, cov: CoverageData) {

    if (!cov.data[lineData.file]) {
      cov.data[lineData.file] = { source: [] };
      try {
        cov.data[lineData.file] = { source: this.ramlCoverage.atl.options.FSResolver.content(lineData.file).split(/\n/g) };
      } catch (e) {

      }
    }

    let data = cov.data[lineData.file];

    if (lineData.line >= 0) {
      while ((lineData.line + 1) > data.source.length) {
        data.source.push(undefined);
      }
    }

    if (lineData.covered) {
      data[lineData.line] = (data[lineData.line] as number || 0) + 1;
    } else {
      data[lineData.line] = data[lineData.line] || 0;
    }
  }

  registerCoverageLine(lineData: {
    file: string;
    line: number;
    lineEnd: number;
    start: number;
    end: number;
    covered: boolean;
  }) {
    this.registerCoverageLineOnData(lineData, this.ramlCoverage.coverageData);
    this.registerCoverageLineOnData(lineData, GlobalCoverageDataCollector);
  }

  getCoverage(): Promise<{ total: number; errored: number; notCovered: number; }> {
    let prom = ATLHelpers.flatPromise();

    let total = 0;
    let notCovered = 0;
    let errored = 0;
    let lines = 0;

    const walk = (assertion: CoverageAssertion) => {
      if (assertion.validationFn) {
        total++;

        if (!assertion.valid) {
          if (assertion.error && (assertion.error instanceof NotImplementedError)) {
            notCovered++;
          } else {
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
        total,
        errored,
        notCovered
      });
    };

    this.resourceAssertion.promise.promise.then(calculateCoverage).catch(calculateCoverage);

    return prom.promise;
  }

  run() {
    return this.resourceAssertion.validate(this.results);
  }
}



export class RAMLCoverage {
  coverageElements: CoverageResource[] = [];
  coverageData: CoverageData = new CoverageData;

  constructor(public raml: RAML.api08.Api | RAML.api10.Api, public atl: ATL) {
    let resources = raml.expand().resources();

    for (let r in resources) {
      this.peekResource(resources[r]);
    }
  }

  private peekResource(resource: RAML.api08.Resource | RAML.api10.Resource, parent?: string) {
    let thisUrl = (parent || "") + resource.relativeUri().value();

    this.coverageElements.push(new CoverageResource(resource as any, this));

    let resources = resource.resources();

    for (let r in resources) {
      this.peekResource(resources[r], thisUrl);
    }
  }

  registerTestResult(test: ATLHelpers.ATLTest, ctx: {
    req: superAgent.SuperAgentRequest;
    res: superAgent.Response;
    test: ATLHelpers.ATLTest;
    url: string;
  }) {
    this.coverageElements.forEach(coverageElement => {
      let matchPart = url.parse(ctx.url);

      if (coverageElement.matches(matchPart.pathname)) {
        coverageElement.resolve(ctx.test, ctx.res);
      }
    });
  }

  writeCoverage(coverFile: string) {
    let cwd = path.dirname(coverFile);

    if (this.coverageData && this.coverageData.data && Object.keys(this.coverageData.data).length) {
      console.info("Writing coverage information: " + coverFile);

      let coverage = '';

      try {
        fs.mkdirSync(cwd);
      } catch (e) { }

      try {
        coverage = fs.readFileSync(coverFile).toString();
      } catch (e) {

      }

      if (coverage.length) coverage = coverage + '\n';

      coverage =
        coverage += Object.keys(this.coverageData.data)
          .filter(x => !!x && !!this.coverageData.data[x])
          .map((file) => {
            let data = this.coverageData.data[file];
            console.info('  Writing ' + file + ' coverage.');

            return coverageToString(file, data);
          }).join('\n');

      fs.writeFileSync(coverFile, coverage);

      this.coverageData.data = {};

      console.info("Writing coverage information. OK!");
    }
  }
}


export class CoverageError extends Error {

}

export class NotImplementedError extends CoverageError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = "Method not implemented";
  }
}

export class OptionalError extends CoverageError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = "Optional Error";
  }
}

export class NoMatchingResults extends NotImplementedError {
  constructor() {
    super("No matching results");
  }
}
