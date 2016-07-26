// Node
import fs = require('fs');
import path = require('path');
import url = require('url');
import util = require('util');

// NPM
import _ = require('lodash');
import request = require('supertest');
import superAgent = require('superagent');
import RAML = require('raml-1-parser');
const pathMatch = require('raml-path-match');


// Locals
import { ATL } from './lib/ATL';
export import ATLHelpers = require('./lib/ATLHelpers');
export import Coverage = require('./lib/Coverage');
export import YAML = require('./lib/YAML');
import { RAMLCoverage } from './lib/Coverage';
export import FileSystem = require('./lib/FileSystem');


export interface IBatOptions {
  baseUri?: string;
  variables?: ATLHelpers.IDictionary<any>;
  file?: string;
  raw?: string;
  loadAssets?: boolean;
  FSResolver?: FileSystem.IFSResolver;
}

export class Bat {
  path: string;
  file: string;

  atl: ATL;
  RAMLCoverage: RAMLCoverage;

  errors = [];

  constructor(public options: IBatOptions = { loadAssets: true }) {
    if (!('loadAssets' in options))
      options.loadAssets = true;

    this.atl = new ATL({
      FSResolver: options.FSResolver,
      loadAssets: options.loadAssets
    });

    let gotAST = ATLHelpers.flatPromise();

    if (options.raw) {
      this.raw(options.raw);
    } else if (options.file) {
      this.load(options.file);
    }
  }

  private updateState() {
    if (this.options.variables) {
      _.merge(this.atl.options.variables, this.options.variables);
    }

    if (this.options.baseUri && this.options.baseUri != 'default') {
      this.atl.options.baseUri = this.options.baseUri;
    }
  }

  load(file: string) {
    this.path = path.dirname(file);
    process.chdir(this.path);
    this.file = file;

    this.raw((this.options.FSResolver || FileSystem.DefaultFileResolver).content(this.file));
  }

  raw(content: string) {
    let parsed = YAML.load(content);

    if (this.file) {
      this.atl.options.file = this.file;
    }

    if (this.file || this.path) {
      this.atl.options.path = this.path || this.file && path.dirname(this.file);
    }

    (this.atl.options.FSResolver as FileSystem.FSResolver).basePath = this.atl.options.path;

    this.atl.options.loadAssets = this.options.loadAssets;
    this.atl.fromAST(parsed as any);

    this.updateState();

    YAML.walkFindingErrors(parsed, this.errors);

    // Parse the raml for coverage
    if (this.atl.raml) {
      this.RAMLCoverage = new RAMLCoverage(this.atl.raml, this.atl);
    }
  }

  run(app?): Promise<{ success: boolean; }[]> {
    let prom = ATLHelpers.flatPromise();

    if (this.errors.length) {
      let errorStr = this.errors.map(YAML.getErrorString).join('\n');
      throw new Error('Can not run with errors. Found ' + this.errors.length + '\n' + errorStr);
    }

    try {
      if (this.atl.options.selfSignedCert) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      if (this.options.baseUri == 'default')
        delete this.options.baseUri;

      if (!app || app === "default" || app === '') {
        app = this.options.baseUri || this.atl.options.baseUri;
      }

      if (!app) {
        throw new Error("baseUri not specified");
      }

      if (typeof app === 'string' && app.substr(-1) === '/') {
        app = app.substr(0, app.length - 1);
      }

      this.atl.agent = request.agent(app);

      // Run tests

      let tests = this.allTests();
      let allDone = [];

      tests.forEach(test => {
        let testResult = test.promise;

        allDone.push(
          testResult
            .then(result => {
              return Promise.resolve({
                success: true
              });
            })
            .catch(result => {
              return Promise.resolve({
                success: false
              });
            })
        );

        if (this.RAMLCoverage && !test.skip) {
          testResult.then(() => {
            this.RAMLCoverage.registerTestResult(test, {
              req: test.requester.superAgentRequest,
              res: test.requester.superAgentResponse,
              test: test,
              url: test.requester.url
            });
          });
        }
      });

      Promise.all(allDone).then(() => prom.resolver());

      Object.keys(this.atl.suites).forEach(x => this.atl.suites[x].run());
    } catch (e) {
      prom.rejecter(e);
    }

    return prom.promise;
  }

  allTests(): ATLHelpers.ATLTest[] {
    return this.atl.allTests();
  }
}

export default Bat;