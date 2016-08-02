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
import ATLTest from './lib/ATLTest';
import ATLRunner from './lib/Runners/ATLRunner';

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

  createRunner(app?): ATLRunner {
    let prom = ATLHelpers.flatPromise();

    if (this.errors.length) {
      let errorStr = this.errors.map(YAML.getErrorString).join('\n');
      throw new Error('Can not run with errors. Found ' + this.errors.length + '\n' + errorStr);
    }


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

    // Run tests

    let runner = new ATLRunner(this.atl, request.agent(app));

    let tests = runner.allTestRunners();

    tests.forEach(test => {
      if (this.RAMLCoverage && test.request) {
        test.request.then(() => {
          this.RAMLCoverage.registerTestResult({
            req: test.request.superAgentRequest,
            res: test.request.value,
            test: test.suite.test,
            url: test.request.url,
            urlObject: test.request.urlObject
          });
        });
      }
    });

    return runner;
  }

  run(app?): ATLRunner {
    let runner = this.createRunner(app);
    runner.run();
    return runner;
  }

  allTests(): ATLTest[] {
    return this.atl.allTests();
  }
}

export default Bat;