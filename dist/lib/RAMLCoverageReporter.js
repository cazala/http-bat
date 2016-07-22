"use strict";
/**
 * Initialize a new LCOV reporter.
 * File format of LCOV can be found here: http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php
 * The reporter is built after this parser: https://raw.github.com/SonarCommunity/sonar-javascript/master/sonar-javascript-plugin/src/main/java/org/sonar/plugins/javascript/coverage/LCOVParser.java
 *
 * @param {Runner} runner
 * @api public
 */
function generateString(filename, data) {
    let sout = [];
    sout.push('SF:' + filename + '\n');
    data.source.forEach(function (line, num) {
        // increase the line number, as JS arrays are zero-based
        num++;
        if (typeof data[num] !== "undefined") {
            sout.push('DA:' + num + ',' + data[num] + '\n');
        }
    });
    sout.push('end_of_record');
    return sout.join('');
}
exports.generateString = generateString;
/**
 * Module dependencies.
 */
const JSONCov = require('mocha/lib/reporters/json-cov');
const fs_1 = require('fs');
const path_1 = require('path');
/**
 * Initialize a new `JsCoverage` reporter.
 *
 * @api public
 * @param {Runner} runner
 */
function HTMLCov(runner) {
    let jade = require('pug');
    let file = path_1.resolve(__dirname, '../coverage-report/coverage.pug');
    let str = fs_1.readFileSync(file, 'utf8');
    let fn = jade.compile(str, { filename: file });
    let self = new JSONCov(runner, false);
    return {
        write(destFile) {
            let content = fn({
                cov: self.cov,
                coverageClass: coverageClass
            });
            console.log('Writing ' + destFile);
            fs_1.writeFileSync(destFile, content);
            console.log('Writing ' + destFile + '. OK!');
        }
    };
}
exports.HTMLCov = HTMLCov;
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
//# sourceMappingURL=RAMLCoverageReporter.js.map