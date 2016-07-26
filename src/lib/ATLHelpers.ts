// NODE
import util = require('util');

// NPM
import methods = require('methods');
import { YAMLNode, YAMLSequence } from 'yaml-ast-parser';

// LOCAL
import { ATL } from './ATL';
export import pointerLib = require('./Pointer');
import { ATLError, ATLResponseAssertion, CommonAssertions } from './ATLAssertion';
import { ATLRequest } from './ATLRequest';
import { IncludedFile, IFSResolver, DefaultFileResolver } from './FileSystem';
import { ASTParser, YAMLAstHelpers, NodeError, KeyValueObject } from './YAML';


export interface IDictionary<T> {
  [key: string]: T;
}

/// ---

export class CanceledError extends Error {
  inspect() {
    return 'CANCELED';
  }
  constructor() {
    super('CANCELED');
  }
}

/// ---

export class ATLSuite {
  constructor(public name: string) {

  }

  dependsOn: ATLSuite[] = [];

  suites: ATLSuite[] = null;
  async: boolean = false;
  descriptor: any = null;
  test: ATLTest = null;
  skip: boolean = false;
  atl: ATL;

  lastSuite: ATLSuite;
  firstSuite: ATLSuite;

  private flatPromise = flatPromise();

  promise = this.flatPromise.promise;

  run() {
    let mutex: Promise<any> = this.dependsOn.length ? Promise.all(this.dependsOn.map(x => x.promise)) : Promise.resolve();

    mutex.then(() => {

      if (this.test) {
        let innerRun = this.test.run();
        innerRun.then(() => this.flatPromise.resolver());
        innerRun.catch(err => this.reject(err));
      } else if (this.suites) {
        if (!this.suites.length) {
          this.flatPromise.resolver();
        } else {
          let innerMutex = Promise.all(this.suites.map(x => x.run()));
          innerMutex.then(() => this.flatPromise.resolver());
          innerMutex.catch(err => {
            this.reject(err);
          });
        }
      } else this.flatPromise.rejecter(new Error('Invalid suite. No tests and no sub suites found. ' + this.name));

    });

    mutex.catch(err => {
      this.reject(err);
    });

    return this.promise;
  }

  private reject(error) {
    if (this.skip && error instanceof Error) {
      this.flatPromise.resolver();
    } else {
      this.flatPromise.rejecter(error);
    }
    this.cancel(error);
  }

  cancel(err: Error) {
    this.flatPromise.rejecter(err);
    if (this.test) this.test.cancel(err);
    if (this.suites && this.suites.length) this.suites.forEach(x => x.cancel(err));
  }
}

/// ---

export interface IATLTestRes {
  status?: number;
  body?: {
    lowLevelNode?: ASTParser.YAMLNode;
    is?: any;
    matches?: KeyValueObject<any>[];
    take?: KeyValueObject<pointerLib.Pointer>[];
    copyTo?: pointerLib.Pointer;
    schema?: any;
    print?: boolean;
  };
  headers?: IDictionary<string>;
  print?: boolean;
  lowLevelNode?: ASTParser.YAMLNode;
}

export interface IATLTestReq {
  attach?: KeyValueObject<string>[];
  form?: KeyValueObject<any>[];
  json?: any;
  urlencoded?: KeyValueObject<any>[];
  queryParameters?: IDictionary<any>;
  headers?: IDictionary<any>;
  lowLevelNode?: ASTParser.YAMLNode;
}

export class ATLTest {
  suite: ATLSuite;

  description: string;
  testId: string;

  method: string;

  uri: string;
  uriParameters: IDictionary<any>;
  skip: boolean = false;

  timeout = 30000;

  response: IATLTestRes = {};
  request: IATLTestReq = {};

  result: any;

  lowLevelNode: ASTParser.YAMLNode;

  private flatPromise = flatPromise();

  promise = this.flatPromise.promise;

  requester: ATLRequest = new ATLRequest(this);
  assertions: ATLResponseAssertion[] = [];

  constructor() {
    this.requester.promise
      .catch(x => this.flatPromise.rejecter(x));
  }

  run(): Promise<void> {
    if (this.skip) {
      this.flatPromise.resolver();
      return this.promise;
    }

    if (!this.assertions.length) {
      this.requester.promise
        .then(x => this.flatPromise.resolver());
    } else {
      let assertionResults = Promise.all(this.assertions.map(x => x.promise));

      assertionResults
        .then(assertionResults => {
          let errors = assertionResults.filter(x => !!x);

          if (errors.length) {
            this.flatPromise.rejecter(errors);
          } else {
            this.flatPromise.resolver();
          }
        });

      assertionResults
        .catch(errors => {
          this.flatPromise.rejecter(errors);
        });
    }

    this.requester.run();

    return this.promise;
  }

  cancel(err: Error) {
    try {
      this.flatPromise.rejecter(err);
    } catch (e) {

    }

    this.assertions.forEach(x => {
      try {
        x.cancel();
      } catch (e) { }
    });

    try {
      this.requester.cancel();
    } catch (e) { }
  }
}

/// ---


const interpreteSuite = {
  skip(suite: ATLSuite, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      let skip = YAMLAstHelpers.readScalar(node);

      suite.skip = !!skip;
    }
  },
  async(suite: ATLSuite, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      let async = YAMLAstHelpers.readScalar(node);

      suite.async = !!async;
    }
  },
  UNKNOWN(suite: ATLSuite, node: YAMLNode, name: string) {

    let method = parseMethodHeader(name);

    if (method) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {



        if (suite.suites.some(x => x.name == name)) {
          throw new NodeError('Duplicated test name: ' + name, node);
        }

        let testSuite = new ATLSuite(name);



        testSuite.atl = suite.atl;

        testSuite.descriptor = YAMLAstHelpers.toObject(node);

        testSuite.test = parseTest(node, suite);

        testSuite.skip = testSuite.test.skip;

        testSuite.test.method = method.method;
        testSuite.test.uri = method.url;

        if (suite.lastSuite)
          testSuite.dependsOn.push(suite.lastSuite);

        suite.lastSuite = testSuite;

        if (!suite.firstSuite)
          suite.firstSuite = testSuite;

        suite.suites.push(testSuite);
      }
    } else {
      throw new NodeError('Invalid node: ' + name, node);
    }
  }
};


const interpreteTest = {
  uriParameters(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      test.uriParameters = {};

      let object = YAMLAstHelpers.getMap(node);

      let keys = Object.keys(object);

      keys.forEach(key => {
        let val = YAMLAstHelpers.readScalar(object[key]) || object[key];
        ensureInstanceOf("uriParameters." + key, val, Number, String, pointerLib.Pointer);
        test.uriParameters[key] = val;
      });
    }
  },
  description(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, String)) {
      let description = YAMLAstHelpers.readScalar(node);

      ensureInstanceOf("description", description, String);

      if (description.trim().length > 0) {
        test.description = description;
        // todo, check for duplicated descriptions
      }
    }
  },
  id(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, String, Number)) {
      let id = YAMLAstHelpers.readScalar(node);

      test.testId = id.toString();
    }
  },
  timeout(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Number)) {
      let value = YAMLAstHelpers.readScalar(node);

      ensureInstanceOf("timeout", value, Number);

      if (value <= 0)
        throw new NodeError("timeout must be a number > 0", node);

      test.timeout = value;
    }
  },
  queryParameters(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      test.request.queryParameters = test.request.queryParameters || {};

      let object = YAMLAstHelpers.getMap(node);

      let keys = Object.keys(object);

      keys.forEach(key => {
        let val = YAMLAstHelpers.readScalar(object[key]) || object[key];

        ensureInstanceOf("queryParameters." + key, val, Number, String, Boolean, pointerLib.Pointer);
        test.request.queryParameters[key] = val;
      });
    }
  },
  headers(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      let object = YAMLAstHelpers.getMap(node);

      let keys = Object.keys(object);

      keys.forEach(key => {
        let val = YAMLAstHelpers.readScalar(object[key]) || object[key];
        ensureInstanceOf("headers." + key, val, String, pointerLib.Pointer);
        test.request.headers[key.toLowerCase()] = val;
      });
    }
  },
  request(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      parseRequest(test, node);
    }
  },
  response(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      parseResponse(test, node);
    }
  },
  skip(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      let id = YAMLAstHelpers.readScalar(node);

      test.skip = !!id;

      if (test.skip) {
        test.requester.cancel();
      }
    }
  }
};



export function parseSuites(sequenceName: string, node: YAMLNode, instance: ATL): ATLSuite {
  let suite = new ATLSuite(sequenceName);

  suite.atl = instance;

  suite.suites = [];

  YAMLAstHelpers.iterpretMap(node, interpreteSuite, false, suite);

  if (suite.skip) {
    // skips all the inner suites and tests
    const recursiveSkip = (suite: ATLSuite) => {
      suite.skip = true;
      suite.suites && suite.suites.forEach(recursiveSkip);
      suite.test && (suite.test.skip = true);
    };

    recursiveSkip(suite);
  }

  return suite;
}


export function parseTest(node: YAMLNode, suite: ATLSuite): ATLTest {
  let test = new ATLTest;
  test.suite = suite;

  test.lowLevelNode = node;

  test.request.headers = test.request.headers || {};

  YAMLAstHelpers.iterpretMap(node, interpreteTest, true, suite, test);

  if (!test.response || !test.response.status) {
    test.response.status = 200;
  }

  generateTestAssertions(test);

  return test;
}

const interpreteRequest = {
  json(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.toObject(node);

    test.request.json = value;
  },

  attach(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.readKVOElems<any>(node as any);

    test.request.attach = [];
    value.forEach(kvo => {
      if (typeof kvo.value != "string")
        new NodeError("request.attach.* must be a path", node);
      else
        test.request.attach.push(kvo);
    });
  },

  form(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.readKVOElems(node as any);

    if (!('content-type' in test.request.headers)) {
      test.request.headers['content-type'] = "multipart/form-data";
    } else {
      new NodeError("you CAN'T use content-type AND form fields", node);
      return;
    }

    test.request.form = value;
  },

  urlencoded(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.readKVOElems(node as any);

    if (!('content-type' in test.request.headers)) {
      test.request.headers['content-type'] = "application/x-www-form-urlencoded";
    } else {
      new NodeError("you CAN'T use content-type AND urlencoded form", node);
    }

    test.request.urlencoded = value;
  }
};

const interpreteResponse = {
  headers(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {
      let value = YAMLAstHelpers.toObject(node);

      test.response.headers = test.response.headers || {};

      let keys = Object.keys(value);

      keys.forEach(key => {
        let val = value[key];
        ensureInstanceOf("response.headers." + key, val, String, pointerLib.Pointer);
        test.response.headers[key.toLowerCase()] = val;
      });
    }
  },
  ['content-type'](suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, String)) {
      let value = YAMLAstHelpers.readScalar(node);

      test.response.headers = test.response.headers || {};

      if ('content-type' in test.response.headers) {
        new NodeError("response.content-type alredy registered as request.header.content-type You can not use BOTH", node);
        return;
      }

      test.response.headers['content-type'] = value;
    }
  },
  status(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Number)) {
      let value = YAMLAstHelpers.readScalar(node);

      test.response.status = parseInt(value) | 0;
    }
  },
  print(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      let value = YAMLAstHelpers.readScalar(node);

      test.response.print = !!value;
    }
  },
  body(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    parseResponseBody(test, node);
  }
};

const interpreteResponseBody = {
  ['is'](suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.toObject(node);
    test.response.body.is = value;
  },
  matches(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.readKVOElems(node as any);

    test.response.body.matches = value;
  },
  schema(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, String)) {
      let value = YAMLAstHelpers.readScalar(node);

      test.response.body.schema = value;
    }
  },
  take(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.isSeq(node)) {
      let value = YAMLAstHelpers.readKVOElems<any>(node as YAMLSequence);

      test.response.body.take = [];

      value.forEach(function (takenElement) {
        if (!(takenElement.value instanceof pointerLib.Pointer))
          node.errors.push(new NodeError("response.body.take.* must be a pointer ex: !!variable myValue", node) as any);
        else
          test.response.body.take.push(takenElement);
      });
    } else {
      /* istanbul ignore else */
      let value = YAMLAstHelpers.toObject(node);

      if (value instanceof pointerLib.Pointer) {
        test.response.body.copyTo = value;
      } else {
        new NodeError("response.body.take must be a sequence of pointers or a !!variable", node);
      }
    }

  },
  print(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    let value = YAMLAstHelpers.readScalar(node);

    ensureInstanceOf("response.body.print", value, Boolean);

    test.response.body.print = value;
  }
};

function parseRequest(test: ATLTest, node: YAMLNode) {
  test.request.lowLevelNode = node;
  if (YAMLAstHelpers.isMap(node)) {
    YAMLAstHelpers.iterpretMap(node, interpreteRequest, true, test.suite, test);
  } else {
    new NodeError("request must be a map", node);
  }
}

function parseResponse(test: ATLTest, node: YAMLNode) {
  test.response.lowLevelNode = node;
  if (YAMLAstHelpers.isMap(node)) {
    YAMLAstHelpers.iterpretMap(node, interpreteResponse, true, test.suite, test);
  } else {
    new NodeError("response must be a map", node);
  }
}

function parseResponseBody(test: ATLTest, responseBody: YAMLNode) {
  test.response.body = {};
  test.response.body.lowLevelNode = responseBody;
  if (YAMLAstHelpers.isMap(responseBody)) {
    YAMLAstHelpers.iterpretMap(responseBody, interpreteResponseBody, true, test.suite, test);
  } else {
    new NodeError("response.body must be a map", responseBody);
  }
}

export function ensureInstanceOf(name: string, value: any, ...types: Function[]): void {
  for (let i = 0; i < types.length; i++) {

    if (typeof types[i] == "function") {
      if (types[i] === Object && typeof value != "object")
        continue;

      if (typeof value != "undefined") {
        if (types[i] === Number && typeof value == "number")
          if (isNaN(value))
            continue;
          else
            return;

        if (types[i] === String && typeof value === 'string')
          return;

        if (types[i] === Boolean && typeof value === 'boolean')
          return;

        if (value instanceof types[i])
          return;
      }
    }
  }

  throw new TypeError(name + " must be instance of " + types.map((x: any) => x && x.displayName || x && x.name || x.toString()).join(" | ") + " got " + util.inspect(value));
}


export function parseMethodHeader(name) {
  let parts: string[] = name.split(/\s+/g);
  let method: string = null;

  method = parts[0].trim().toLowerCase();

  if (method.length == 0)
    return null;

  // methods should have 2 parts
  if (parts.length != 2)
    return null;

  if (parts[0] != parts[0].toUpperCase())
    return null;

  if (methods.indexOf(method) == -1)
    throw new TypeError("ERROR: unknown method " + method + " on " + name);

  // if the URL doesn't starts with "/"
  if (parts[1].substr(0, 1) != '/' && parts[1].substr(0, 1) != '?')
    throw new Error("ERROR: the url must starts with '/' or '?': " + name);

  // if the URL ends with "/"
  if (parts[1].substr(-1) == '/' && parts[1].length > 1)
    throw new Error("ERROR: the url must not ends with '/': " + name);

  if (parts[1].indexOf('#') != -1)
    parts[1] = parts[1].substr(0, parts[1].indexOf('#'));

  return {
    method: method,
    url: parts[1]
  };
}

export function cloneObjectUsingPointers<T>(baseObject: T, store, fsResolver?: IFSResolver): any {
  if (typeof baseObject !== "object") {
    return baseObject;
  }

  return cloneObject(baseObject, store, fsResolver);
}

function cloneObject(obj, store, fsResolver?: IFSResolver) {

  if (obj === null || obj === undefined)
    return obj;

  if (typeof obj == "string" || typeof obj == "number" || typeof obj == "boolean")
    return obj;

  // Handle Date (return new Date object with old value)
  if (obj instanceof Date) {
    return new Date(obj);
  }

  if (obj instanceof String || obj instanceof Number || obj instanceof Boolean) {
    return obj;
  }

  if (obj instanceof IncludedFile) {
    if (!fsResolver) {
      return undefined;
    }

    let content;


    content = (obj as IncludedFile).content(fsResolver);

    if (content === null) {
      console.error("cloneObject::Error::Failed to load " + obj.path);
      return undefined;
    }

    if ((obj as IncludedFile).path.toLowerCase().substr(-5) == '.json') {
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error("cloneObject::Error::Failed to load " + obj.path + ". Invalid JSON: " + e.toString());
        return undefined;
      }
    }

    return content;
  }

  // Handle Array (return a full slice of the array)
  if (obj instanceof Array) {
    let newArray = obj.slice();
    return newArray.map(x => cloneObject(x, store, fsResolver));
  }

  if (obj instanceof pointerLib.Pointer) {
    let result: any;
    try {
      let gottenValue = obj.get(store);
      result = cloneObject(gottenValue, store, fsResolver);
    } catch (e) {
      console.error("cloneObject::Error", e);
      throw e;
    }

    return result;
  }

  if (obj instanceof RegExp) {
    return obj;
  }

  // Handle Object
  if (obj instanceof Object) {
    let copy = new obj.constructor();
    for (let attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        copy[attr] = cloneObject(obj[attr], store, fsResolver);
      }
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported. " + util.inspect(obj));
}


export function flatPromise() {
  let result = {
    resolver: null as (a?: any) => any,
    rejecter: null as (a: any) => any,
    promise: null as Promise<any>
  };

  result.promise = new Promise((a, b) => {
    result.resolver = a;
    result.rejecter = function (x) {
      b(x);
      result.rejecter = function () { };
    };
  });

  return result;
}


export function errorDiff(msg, expected, actual, ctx) {
  let err = new Error(msg) as any;
  if (ctx) {
    err.message = null;
    err.inspect = function () {
      err.message = msg;
      return msg + "\n" + JSON.stringify(ctx, null, 2);
    };
  }
  err.expected = expected;
  err.actual = actual;
  err.showDiff = true;
  return err;
}


export function error(msg, ctx) {
  let err = new Error(msg) as any;
  if (ctx) {
    err.message = null;
    err.inspect = function () {
      err.message = msg;
      return msg + "\n" + JSON.stringify(ctx, null, 2);
    };
  }
  return err;
}


if (!(error('test', {}) instanceof Error)) process.exit(1);
if (!(errorDiff('test', 1, 2, {}) instanceof Error)) process.exit(1);


function generateTestAssertions(test: ATLTest) {
  if (test.suite.skip) return;

  if (test.response) {
    if (test.response.status) {
      test.assertions.push(
        new CommonAssertions.StatusCodeAssertion(test, test.response.status)
      );
    }

    if (test.response.body) {
      if ('is' in test.response.body) {
        test.assertions.push(
          new CommonAssertions.BodyEqualsAssertion(test, test.response.body.is)
        );
      }

      if (test.response.body.schema) {
        test.assertions.push(
          new CommonAssertions.ValidateSchemaOperation(test, test.response.body.schema)
        );
      }

      if (test.response.body.matches) {
        test.response.body.matches.forEach(kvo => {
          test.assertions.push(
            new CommonAssertions.BodyMatchesAssertion(test, kvo.key, kvo.value)
          );
        });
      }

      if (test.response.headers) {
        for (let h in test.response.headers) {
          test.assertions.push(
            new CommonAssertions.HeaderMatchesAssertion(test, h, test.response.headers[h])
          );
        }
      }

      if (test.response.body.take) {
        let take = test.response.body.take;

        take.forEach(function (takenElement) {
          test.assertions.push(
            new CommonAssertions.CopyBodyValueOperation(test, takenElement.key, takenElement.value)
          );
        });
      }

      if (test.response.body.copyTo && test.response.body.copyTo instanceof pointerLib.Pointer) {
        test.assertions.push(
          new CommonAssertions.CopyBodyValueOperation(test, '*', test.response.body.copyTo)
        );
      }
    }
  }
}