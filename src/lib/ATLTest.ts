import { ATLSuite } from './ATLSuite';
import { Pointer } from './Pointer';
import { IDictionary, flatPromise } from './ATLHelpers';
import { KeyValueObject, ASTParser } from './YAML';

export interface IATLTestRes {
  status?: number;
  body?: {
    lowLevelNode?: ASTParser.YAMLNode;
    is?: any;
    matches?: KeyValueObject<any>[];
    take?: KeyValueObject<Pointer>[];
    copyTo?: Pointer;
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
  wrapperSuite: ATLSuite;

  description: string;
  testId: string;

  method: string;

  uri: string;
  uriParameters: IDictionary<any>;

  timeout = 30000;

  response: IATLTestRes = {};
  request: IATLTestReq = {};

  result: any;

  lowLevelNode: ASTParser.YAMLNode;
/*
  private flatPromise = flatPromise();

  promise = this.flatPromise.promise;

  requester: ATLRequest = new ATLRequest(this);
  assertions: ATLResponseAssertion[] = [];

  constructor() {
    this.requester.catch(x => this.flatPromise.rejecter(x));
  }

  run(): Promise<void> {
    if (this.skip) {
      this.flatPromise.resolver();
      return this.promise;
    }

    if (!this.assertions.length) {
      this.requester.then(x => this.flatPromise.resolver());
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
  */
}

export default ATLTest;