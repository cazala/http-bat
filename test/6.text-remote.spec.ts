/// <reference path="typings/index.d.ts" />

import { Bat, YAML } from '../dist';
import { registerMochaSuites } from '../dist/adapters/mocha';

const glob = require('glob');

declare var describe, it;

let foundFiles: string[] = glob.sync('valid-specs/**/*.remote.spec.yml', {
  nodir: true,
  cwd: __dirname,
  realpath: true,
  stat: true
});

foundFiles.forEach(file => {
  describe(file, () => {
    let instance = new Bat();

    instance.load(file);

    let runner = instance.run();

    registerMochaSuites(runner, instance);


  });
});