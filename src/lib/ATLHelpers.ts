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
import { ASTParser, YAMLAstHelpers, KeyValueObject } from './YAML';

import { NodeError } from './Exceptions';

import ATLTest from './ATLTest';
import ATLSuite from './ATLSuite';

export interface IDictionary<T> {
  [key: string]: T;
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
  soft(suite: ATLSuite, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      suite.soft = !!YAMLAstHelpers.readScalar(node);
    }
  },
  UNKNOWN(suite: ATLSuite, node: YAMLNode, name: string) {

    let method = parseMethodHeader(name);

    if (method) {
      if (YAMLAstHelpers.ensureInstanceOf(node, Object)) {



        if (suite.suites.some(x => x.name == name)) {
          throw new NodeError('Duplicated test name: ' + name, node);
        }

        let wrapperSuite = new ATLSuite(name);

        wrapperSuite.atl = suite.atl;

        wrapperSuite.descriptor = YAMLAstHelpers.toObject(node);

        wrapperSuite.test = parseTest(node, suite, wrapperSuite);

        wrapperSuite.test.method = method.method;
        wrapperSuite.test.uri = method.url;

        suite.suites.push(wrapperSuite);
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

      // todo, check for duplicated ids
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
      test.wrapperSuite.skip = !!YAMLAstHelpers.readScalar(node);
    }
  },
  soft(suite: ATLSuite, test: ATLTest, node: YAMLNode) {
    if (YAMLAstHelpers.ensureInstanceOf(node, Boolean)) {
      test.wrapperSuite.soft = !!YAMLAstHelpers.readScalar(node);
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
    };

    recursiveSkip(suite);
  }

  return suite;
}


export function parseTest(node: YAMLNode, suite: ATLSuite, wrapperSuite: ATLSuite): ATLTest {
  let test = new ATLTest;
  test.wrapperSuite = wrapperSuite;
  test.suite = suite;

  test.lowLevelNode = node;

  test.request.headers = test.request.headers || {};

  YAMLAstHelpers.iterpretMap(node, interpreteTest, true, suite, test);

  if (!test.response || !test.response.status) {
    test.response.status = 200;
  }

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
