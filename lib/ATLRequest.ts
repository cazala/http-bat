// NODE
import { inspect } from 'util';
import url = require('url');
import path = require('path');
import queryString = require('querystring');

// NPM
import { Response, SuperAgentRequest } from 'superagent';
import _ = require('lodash');

// LOCAL
import { ATLTest, cloneObjectUsingPointers, flatPromise, CanceledError } from './ATLHelpers';
import { Pointer } from './Pointer';

const reIsInterpolation = /\{([^.[\]\}\{]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\3)[^\\\{\}]|\\.)*?)\3)\]|(?=(\.|\[\])(?:\5|$)))\}{1}/g;

export class ATLRequest {
  urlObject: url.Url;
  url: string;

  superAgentRequest: SuperAgentRequest;
  superAgentResponse: Response;

  private flatPromise = flatPromise();

  promise: Promise<Response> = this.flatPromise.promise;

  constructor(public test: ATLTest) {

  }

  run(): Promise<Response> {
    try {
      this._run();
    } catch (e) {
      this.flatPromise.rejecter(e);
    }

    return this.promise;
  }

  private _run() {

    this.urlObject = url.parse(this.test.uri, true);

    this.urlObject.query = this.urlObject.query || {};

    if (typeof this.urlObject.query == "string") {
      this.urlObject.query = queryString.parse(this.urlObject.query);
    }

    if (this.test.request.queryParameters) {
      if ('search' in this.urlObject)
        delete this.urlObject.search;

      let qsParams = cloneObjectUsingPointers(this.test.request.queryParameters, this.test.suite.atl.options.variables);

      for (let i in qsParams) {
        let typeOfValue = typeof qsParams[i];

        if (typeOfValue == 'undefined') continue;

        if (typeOfValue != 'string' && typeOfValue != 'number') {
          throw new Error("Only strings and numbers are allowed on queryParameters. " + i + "=" + inspect(qsParams[i]));
        }

        this.urlObject.query[i] = qsParams[i];
      }
    }

    let uriParametersBag = {};

    for (let i in this.test.uriParameters) {
      let value = null;

      if (this.test.uriParameters[i] instanceof Pointer) {
        value = this.test.uriParameters[i].get(this.test.suite.atl.options.variables);
      } else {
        value = this.test.uriParameters[i];
      }

      let typeOfValue = typeof value;


      if (typeOfValue != 'string' && typeOfValue != 'number') {
        throw new Error("Only strings and numbers are allowed on uriParameters. " + i + "=" + inspect(value));
      }

      uriParametersBag[i] = value;
    }

    this.urlObject.pathname = this.urlObject.pathname.replace(reIsInterpolation, (fulltext, match) => {
      let value = null;


      if (match in uriParametersBag) {
        value = uriParametersBag[match];
      } else {
        value = _.get(this.test.suite.atl.options.variables, match);
      }

      let typeOfValue = typeof value;

      if (typeOfValue == "undefined")
        throw new Error("Can not resolve uriParameter " + match);

      if (typeOfValue != 'string' && typeOfValue != 'number') {
        throw new Error("Invalid uriParameter: " + match + "=" + inspect(value));
      }

      return encodeURIComponent(value);
    });

    this.url = url.format(this.urlObject);


    let req: SuperAgentRequest = this.superAgentRequest = this.test.suite.atl.agent[this.test.method.toLowerCase()](this.url);

    // we must send some data..
    if (this.test.request) {
      if (this.test.request.headers) {
        let headers = cloneObjectUsingPointers(this.test.request.headers, this.test.suite.atl.options.variables);

        for (let h in headers) {
          req.set(h, headers[h] == undefined ? '' : headers[h].toString());
        }
      }

      if (this.test.request.json) {
        let data = cloneObjectUsingPointers(this.test.request.json, this.test.suite.atl.options.variables);
        req.send(data);
      }

      if (this.test.request.attach) {
        if (!this.test.suite.atl.options.path) {
          throw new Error("attach is not allowed using RAW definitions");
        }

        for (let i in this.test.request.attach) {
          let currentAttachment = this.test.request.attach[i];
          req.attach(currentAttachment.key, path.resolve(this.test.suite.atl.options.path, currentAttachment.value));
        }
      }

      if (this.test.request.form) {
        req.type('form');

        for (let i in this.test.request.form) {
          let currentAttachment = cloneObjectUsingPointers(this.test.request.form[i], this.test.suite.atl.options.variables);
          req.field(currentAttachment.key, currentAttachment.value);
        }
      }

      if (this.test.request.urlencoded) {
        req.type('form');

        let holder: any = {};

        this.test.request.urlencoded.forEach(x => {
          if (x.key in holder) {
            if (!(holder[x.key] instanceof Array)) {
              holder[x.key] = [holder[x.key]];
            }
            holder[x.key].push(cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables));
          } else {
            holder[x.key] = cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables);
          }
        });

        req.send(holder);
      }

      // TODO add RAW body, add elseifs validations
    }

    req.timeout(this.test.timeout);

    req.end((err, res) => {
      this.superAgentResponse = res;

      if (err) {
        return this.flatPromise.rejecter(new Error(err.toString()));
      }

      return this.flatPromise.resolver(res);
    });
  }

  cancel() {
    this.flatPromise.rejecter(new CanceledError());

    try {
      this.superAgentRequest && this.superAgentRequest.abort();
    } catch (e) { }
  }
}