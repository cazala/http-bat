import { ICovData } from './Coverage';

/**
 * Initialize a new LCOV reporter.
 * File format of LCOV can be found here: http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php
 * The reporter is built after this parser: https://raw.github.com/SonarCommunity/sonar-javascript/master/sonar-javascript-plugin/src/main/java/org/sonar/plugins/javascript/coverage/LCOVParser.java
 *
 * @param {Runner} runner
 * @api public
 */

export function generateString(filename: string, data: ICovData): string {
  let sout = [];

  sout.push('SF:' + filename + '\n');

  data.source.forEach(function (line, num) {
    // increase the line number, as JS arrays are zero-based
    num++;

    if (typeof data[num] !== "undefined") {
      sout.push('DA:' + (num + 1) + ',' + data[num] + '\n');
    }
  });

  sout.push('end_of_record');

  return sout.join('');
}



/**
 * Module dependencies.
 */

const JSONCov = require('mocha/lib/reporters/json-cov');

import { readFileSync, writeFileSync } from 'fs';

import { join, dirname } from 'path';


/**
 * Initialize a new `JsCoverage` reporter.
 *
 * @api public
 * @param {Runner} runner
 */
export function HTMLCov(runner) {
  let jade = require('jade');
  let file = require.resolve('mocha/lib/reporters/templates/coverage.jade');
  let str = readFileSync(file, 'utf8');
  let fn = jade.compile(str, { filename: file });
  let self = new JSONCov(runner, false);

  return {
    write(destFile: string) {
      let content = fn({
        cov: self.cov,
        coverageClass: coverageClass
      });

      console.log(content);

      writeFileSync(destFile, content);
    }
  };
}

/**
 * Return coverage class for a given coverage percentage.
 *
 * @api private
 * @param {number} coveragePctg
 * @return {string}
 */
function coverageClass(coveragePctg) {
  if (coveragePctg >= 90) {
    return 'high';
  }
  if (coveragePctg >= 80) {
    return 'medium';
  }
  if (coveragePctg >= 50) {
    return 'low';
  }
  return 'terrible';
}
