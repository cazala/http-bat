/// <reference path="typings/index.d.ts" />

import { Bat, YAML } from '../dist';

const glob = require('glob');

declare var describe, it;

let foundFiles: string[] = glob.sync('invalid-specs/**/*.yml', {
  nodir: true,
  cwd: __dirname,
  realpath: true,
  stat: true
});

foundFiles.forEach(file => {
  describe(file, () => {
    it('must fail on parsing', (done) => {
      let instance = new Bat();

      instance.load(file);

      if (instance.errors.length) {
        instance.errors.forEach(element => {
          YAML.printError(element);
        });
        done();
      } else {
        done(new Error('MUST FAIL ON PARSING'));
      }
    });
  });
});

foundFiles = glob.sync('valid-specs/**/*.spec.yml', {
  nodir: true,
  cwd: __dirname,
  realpath: true,
  stat: true
});

foundFiles.forEach(file => {
  describe(file, () => {
    it('must parse without errors', (done) => {
      let instance = new Bat();

      instance.load(file);

      if (instance.errors.length) {
        instance.errors.forEach(element => {
          YAML.printError(element);
        });
        done(instance.errors[0]);
      } else {
        done();
      }
    });
  });
});