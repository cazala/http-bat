// NODE
import { inspect } from 'util';
import url = require('url');
import path = require('path');
import queryString = require('querystring');

// NPM
import { Response, SuperAgentRequest } from 'superagent';
import _ = require('lodash');

// LOCAL
import { cloneObjectUsingPointers, flatPromise } from './ATLHelpers';
import { Pointer } from './Pointer';
import Interpolation = require('./Interpolation');
import ATLTest from './ATLTest';
import Runnable from './Runnable';

import { CanceledError } from './Exceptions';
import ATLRunner from './Runners/ATLRunner';

export class ATLRequest extends Runnable<Response> {
  urlObject: url.Url;
  url: string;

  superAgentRequest: SuperAgentRequest;

  constructor(public test: ATLTest, public ATLRunner: ATLRunner) {
    super(runnable => {
      this.urlObject = url.parse(this.test.uri, true);

      this.urlObject.query = this.urlObject.query || {};

      if (typeof this.urlObject.query == "string") {
        this.urlObject.query = queryString.parse(this.urlObject.query);
      }

      if (this.test.request.queryParameters) {
        if ('search' in this.urlObject)
          delete this.urlObject.search;

        let qsParams = cloneObjectUsingPointers(this.test.request.queryParameters, this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver);

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
          throw new Error("Only strings and numbers are allowed on uriParameters. " + i + "=" + inspect(value) + " (" + inspect(this.test.uriParameters[i]) + ")");
        }

        uriParametersBag[i] = value;
      }

      this.urlObject.pathname = Interpolation.interpolateString(this.urlObject.pathname, uriParametersBag);
      this.urlObject.pathname = Interpolation.interpolateString(this.urlObject.pathname, this.test.suite.atl.options.variables);

      Interpolation.ensureAllInterpolations(this.urlObject.pathname);

      this.url = url.format(this.urlObject);

      let req: SuperAgentRequest = this.superAgentRequest = this.ATLRunner.agent[this.test.method.toLowerCase()](this.url);

      // we must send some data..
      if (this.test.request) {
        if (this.test.request.headers) {
          let headers = cloneObjectUsingPointers(this.test.request.headers, this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver);

          for (let h in headers) {
            req.set(h, headers[h] == undefined ? '' : headers[h].toString());
          }
        }

        if (this.test.request.json) {
          let data = cloneObjectUsingPointers(this.test.request.json, this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver);
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
            let currentAttachment = cloneObjectUsingPointers(this.test.request.form[i], this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver);
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
              holder[x.key].push(cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver));
            } else {
              holder[x.key] = cloneObjectUsingPointers(x.value, this.test.suite.atl.options.variables, this.test.suite.atl.options.FSResolver);
            }
          });

          req.send(holder);
        }

        // TODO add RAW body, add elseifs validations
      }

      let prom = flatPromise();

      req.timeout(this.test.timeout);

      req.end((err, res) => {
        if (err) {
          return prom.rejecter(new Error(err.toString()));
        }

        return prom.resolver(res);
      });

      return prom.promise;
    });

    this.name = this.test.method.toUpperCase() + ' ' + this.test.uri;

    this.onCancel(() => this.superAgentRequest && this.superAgentRequest.abort());
  }
}

export default ATLRequest;