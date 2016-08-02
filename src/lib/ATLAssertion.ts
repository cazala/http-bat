import { cloneObjectUsingPointers, flatPromise } from './ATLHelpers';
import { inspect } from 'util';
import { Response } from 'superagent';
import _ = require('lodash');
import { Pointer } from './Pointer';
import ATLTest from './ATLTest';

import { CanceledError } from './Exceptions';

import { Runnable } from './Runnable';
import ATLRequest from './ATLRequest';

export class ATLError extends Error {
  expected: any;
  actual: any;
  assertion: ATLResponseAssertion;
  text = '';
  constructor(message: string) {
    super(message);
    this.message = '';
    this.text = message;
  }

  toString() {
    return this.text;
  }

  inspect() {
    return this.text;
  }
}

export abstract class ATLResponseAssertion extends Runnable<boolean> {
  name: string;

  skip: boolean = false;

  constructor(public request: ATLRequest) {
    super(runnable => {
      let result: any = this.validate(this.request.value);

      if (!result)
        return Promise.resolve(true);

      return result;
    });

    this.addDependency(request);
  }

  emitError(data: { actual?: any; expected?: any; message: string }) {
    let message = data.message
      .replace('{actual}', inspect(data.actual))
      .replace('{expected}', inspect(data.expected));

    let err = new ATLError(message);
    err.actual = data.actual;
    err.expected = data.expected;
    err.assertion = this;
    throw err;
  }

  abstract validate(response: Response): Promise<boolean> | void;

  protected getObjectValue(object: any) {
    return cloneObjectUsingPointers(object, this.request.test.suite.atl.options.variables, this.request.test.suite.atl.options.FSResolver);
  }
}

export namespace CommonAssertions {

  export class PromiseAssertion extends ATLResponseAssertion {
    constructor(parent: ATLRequest, name: string, public evaluator: (res: Response) => Promise<boolean>) {
      super(parent);
      this.name = name;
    }

    validate(response: Response) {
      return this
        .evaluator(response)
        .catch(err => Promise.resolve(err));
    }
  }

  export class StatusCodeAssertion extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public statusCode: number) {
      super(parent);
      this.name = "response.status == " + statusCode;
    }

    validate(response: Response) {
      if (response.status != this.statusCode) {
        debugger;
        this.emitError({
          message: 'expected status code {expected} got {actual} instead',
          expected: this.statusCode,
          actual: response.status
        });
      }
    }
  }

  export class BodyEqualsAssertion extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public bodyIs: any) {
      super(parent);
      this.name = "response.body is #value";
    }

    validate(response: Response) {
      if (this.bodyIs && typeof this.bodyIs == "object" && this.bodyIs instanceof RegExp) {
        /* istanbul ignore if */
        if (!this.bodyIs.test(response.text)) {
          this.emitError({
            message: 'expected response.body to match {expected}, got {actual}',
            expected: this.bodyIs,
            actual: response.text
          });
        }
      } else {
        let takenBody;

        if (typeof this.bodyIs == "string") {
          takenBody = response.text;
        } else {
          takenBody = response.body;
        }

        let bodyEquals = this.getObjectValue(this.bodyIs);

        /* istanbul ignore if */
        if (!_.isEqual(bodyEquals, takenBody)) {
          this.emitError({
            message: 'expected response.body {expected}, got {actual}',
            expected: bodyEquals,
            actual: takenBody
          });
        }
      }
    }
  }


  export class BodyMatchesAssertion extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public key: string, public value: any) {
      super(parent);
      this.name = "response.body::" + key;
    }

    validate(response: Response) {
      let value: any = this.getObjectValue(this.value);

      let readed = _.get(response.body, this.key);

      if (
        (!(value instanceof RegExp) && !_.isEqual(readed, value))
        ||
        ((value instanceof RegExp) && !value.test(readed))
      ) {
        this.emitError({
          message: 'expected response.body::' + this.key + ' to match {expected}, got {actual}',
          expected: value,
          actual: readed
        });
      }
    }
  }


  export class CopyBodyValueOperation extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public key: string, public keyValue: Pointer) {
      super(parent);
      this.name = "response.body::" + key + " >> !variables " + keyValue.path;
    }

    validate(response: Response) {
      if (this.key === '*') {
        this.keyValue.set(this.request.test.suite.atl.options.variables, response.body);
      } else {
        let takenValue = _.get(response.body, this.key);
        this.keyValue.set(this.request.test.suite.atl.options.variables, takenValue);
      }
    }
  }

  export class ValidateSchemaOperation extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public schema: string) {
      super(parent);
      this.name = "response.body schema " + schema;
    }

    validate(response: Response) {
      let v = this.request.test.suite.atl.obtainSchemaValidator(this.schema);

      let validationResult = v(response.body);

      if (!validationResult.valid) {
        let errors = ["Schema error:"];

        validationResult.errors && validationResult.errors.forEach(x => errors.push("  " + x.stack));

        this.emitError({ message: errors.join('\n') });
      }
    }
  }

  export class HeaderMatchesAssertion extends ATLResponseAssertion {
    constructor(parent: ATLRequest, public header: string, public value: any) {
      super(parent);
      this.header = header.toLowerCase();
      this.name = "response.header::" + header;
    }

    validate(response: Response) {
      let value: any = this.getObjectValue(this.value);

      let readed = response.get(this.header);

      if (this.header === 'content-type') {
        if (readed.indexOf(';') != -1) {
          readed = readed.substr(0, readed.indexOf(';')).trim();
        }
      }

      if (
        typeof value != "string" &&
        typeof value != "number" &&
        typeof value != "undefined" &&
        typeof value != "object" &&
        !(value instanceof RegExp) &&
        value !== null
      ) {
        this.emitError({
          message: 'readed value of header MUST be string, number or undefined, got {expected} instead. response.header::' + this.header + ' is {actual}',
          expected: value,
          actual: readed
        });
      }

      if (
        (!(value instanceof RegExp) && !_.isEqual(readed, value))
        ||
        ((value instanceof RegExp) && !value.test(readed))
      ) {
        this.emitError({
          message: 'expected response.header::' + this.header + ' to match {expected}, got {actual}',
          expected: value,
          actual: readed
        });
      }
    }
  }
}