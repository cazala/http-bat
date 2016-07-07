"use strict";
var util = require('util');
var ATLHelpers = require('./ATLHelpers');
var _ = require('lodash');
var RAML = require('raml-1-parser');
if (typeof Promise != 'function')
    require('es6-promise').polyfill();
var ATL = (function () {
    function ATL() {
        this.options = {
            variables: {},
            path: null,
            file: null,
            selfSignedCert: false,
            raml: {
                coverage: true,
                resourceTypes: true,
                traits: true
            }
        };
        this.suites = {};
        this.schemas = {};
    }
    ATL.prototype.fromObject = function (object) {
        var _this = this;
        if (typeof object !== "object")
            throw new TypeError("fromObject: the first parameter must be an object");
        // merge the variables
        if ('variables' in object) {
            if (typeof object.variables != "object")
                throw new TypeError("fromObject.variables: MUST be an object");
            this.options.variables = _.merge(this.options.variables || {}, object.variables);
        }
        else {
            this.options.variables = this.options.variables || {};
        }
        // override variables.ENV if not exists or is an object
        if (!this.options.variables['ENV'] || typeof this.options.variables['ENV'] != "object")
            this.options.variables['ENV'] = {};
        _.extend(this.options.variables['ENV'], _.cloneDeep(process.env));
        // prepare the baseUri
        if ('baseUri' in object) {
            if (typeof object.baseUri == "string")
                this.options.baseUri = object.baseUri;
            else
                throw new TypeError("baseUri: invalid type");
            if (this.options.baseUri.substr(-1) === '/') {
                this.options.baseUri = this.options.baseUri.substr(0, this.options.baseUri.length - 1);
            }
        }
        if ('options' in object) {
            ATLHelpers.ensureInstanceOf("options", object.options, Object);
            Object.keys(object.options).forEach(function (key) {
                var value = object.options[key];
                switch (key) {
                    case 'selfSignedCert':
                        ATLHelpers.ensureInstanceOf("options.selfSignedCert", value, Boolean);
                        _this.options.selfSignedCert = !!value;
                        break;
                    case 'raml':
                        ATLHelpers.ensureInstanceOf("options.raml", value, Object);
                        _.merge(_this.options.raml, value);
                        break;
                    default:
                        throw new TypeError("unknown option:" + key);
                }
            });
        }
        if ('baseUriParameters' in object) {
            if (!object.baseUriParameters || typeof object.baseUriParameters != "object" || object.baseUriParameters instanceof Array)
                throw new TypeError("baseUriParameters: MUST be a dictionary");
            this.options.baseUriParameters = _.cloneDeep(object.baseUriParameters);
        }
        // parse the tests
        if ('tests' in object) {
            if (!object.tests || typeof object.tests != "object" || object.tests instanceof Array) {
                throw new TypeError("tests: MUST be a dictionary");
            }
            var suite_1 = null;
            for (var sequenceName in object.tests) {
                suite_1 = ATLHelpers.parseSuites(object.tests[sequenceName], this);
                suite_1.name = sequenceName;
                this.suites[suite_1.name] = suite_1;
            }
        }
        if ('schemas' in object) {
            if (!object.schemas || !(object.schemas instanceof Array)) {
                throw new TypeError("schemas: MUST be a list");
            }
            for (var sequenceName in object.schemas) {
                var schemaName = null;
                if (typeof object.schemas[sequenceName] == "string") {
                    // load string schema by path
                    // TODO, load schema
                    this._addSchema(sequenceName, {});
                }
                else if (typeof object.schemas[sequenceName] == "object") {
                    this._addSchema(schemaName, object.schemas[sequenceName]);
                }
                else {
                    throw new TypeError("schemas: invalid schema " + sequenceName);
                }
            }
        }
        if ('raml' in object) {
            if (!object.raml || typeof object.raml != "string") {
                throw new TypeError("raml: MUST be a string");
            }
            try {
                this.raml = RAML.loadApiSync(object.raml, { rejectOnErrors: true });
            }
            catch (e) {
                if (e.parserErrors) {
                    e.message = e.message + "\n" + e.parserErrors.map(function (x) { return "  " + x.message + " line " + x.line; }).join("\n");
                }
                else {
                    console.log(util.inspect(e));
                }
                throw e;
            }
            var schemas = this.raml.schemas();
            for (var i in schemas) {
                var schemaList = schemas[i].toJSON();
                for (var schemaName in schemaList) {
                    var json = null;
                    try {
                        json = JSON.parse(schemaList[schemaName]);
                        this._addSchema(schemaName, json);
                    }
                    catch (e) {
                        e.message = 'Error parsing JSON schema ' + schemaName + '\n\t' + e.message + '\n' + util.inspect(schemaList[schemaName]);
                        throw e;
                    }
                }
            }
        }
        for (var suiteKey in this.suites) {
            this.replaceSchema(this.suites[suiteKey]);
        }
    };
    ATL.prototype.replaceSchema = function (suite) {
        if (suite.test && suite.test.response.body && suite.test.response.body.schema) {
            if (typeof suite.test.response.body.schema == "string") {
                if (suite.test.response.body.schema in this.schemas) {
                    suite.test.response.body.schema = this.schemas[suite.test.response.body.schema];
                }
                else {
                    throw new Error('schema ' + suite.test.response.body.schema + ' not found on test ' + suite.test.method + ' ' + suite.test.uri);
                }
            }
        }
        if (suite.suites) {
            for (var suiteKey in suite.suites) {
                this.replaceSchema(suite.suites[suiteKey]);
            }
        }
    };
    ATL.prototype._addSchema = function (schemaName, schema) {
        if (schemaName in this.schemas)
            throw new TypeError("schemas: duplicated schema " + schemaName);
        // VALIDATE SCHEMA
        this.schemas[schemaName] = schema;
    };
    return ATL;
}());
exports.ATL = ATL;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQVRMLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiQVRMLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxJQUFPLElBQUksV0FBVyxNQUFNLENBQUMsQ0FBQztBQUU5QixJQUFPLFVBQVUsV0FBVyxjQUFjLENBQUMsQ0FBQztBQUM1QyxJQUFPLENBQUMsV0FBVyxRQUFRLENBQUMsQ0FBQztBQUM3QixJQUFPLElBQUksV0FBVyxlQUFlLENBQUMsQ0FBQztBQUd2QyxFQUFFLENBQUMsQ0FBQyxPQUFPLE9BQU8sSUFBSSxVQUFVLENBQUM7SUFDL0IsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBZ0JwQztJQUFBO1FBQ0UsWUFBTyxHQUFnQjtZQUNyQixTQUFTLEVBQUUsRUFBRTtZQUNiLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixjQUFjLEVBQUUsS0FBSztZQUNyQixJQUFJLEVBQUU7Z0JBQ0osUUFBUSxFQUFFLElBQUk7Z0JBQ2QsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLE1BQU0sRUFBRSxJQUFJO2FBQ2I7U0FDRixDQUFDO1FBSUYsV0FBTSxHQUFnRCxFQUFFLENBQUM7UUFFekQsWUFBTyxHQUFnQyxFQUFFLENBQUM7SUFvSzVDLENBQUM7SUFsS0Msd0JBQVUsR0FBVixVQUFXLE1BQVc7UUFBdEIsaUJBc0lDO1FBcklDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sTUFBTSxLQUFLLFFBQVEsQ0FBQztZQUM3QixNQUFNLElBQUksU0FBUyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFFM0Usc0JBQXNCO1FBQ3RCLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUM7Z0JBQ3RDLE1BQU0sSUFBSSxTQUFTLENBQUMseUNBQXlDLENBQUMsQ0FBQztZQUVqRSxJQUFJLENB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QUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcscUJBQXFCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xJLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEdBQUcsQ0FBQyxDQUFDLElBQUksUUFBUSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUM3QyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFTyx3QkFBVSxHQUFsQixVQUFtQixVQUFrQixFQUFFLE1BQVc7UUFDaEQsRUFBRSxDQUFDLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDN0IsTUFBTSxJQUFJLFNBQVMsQ0FBQyw2QkFBNkIsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUVsRSxrQkFBa0I7UUFFbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxNQUFNLENBQUM7SUFDcEMsQ0FBQztJQUNILFVBQUM7QUFBRCxDQUFDLEFBckxELElBcUxDO0FBckxZLFdBQUcsTUFxTGYsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG5pbXBvcnQgQVRMSGVscGVycyA9IHJlcXVpcmUoJy4vQVRMSGVscGVycycpO1xuaW1wb3J0IF8gPSByZXF1aXJlKCdsb2Rhc2gnKTtcbmltcG9ydCBSQU1MID0gcmVxdWlyZSgncmFtbC0xLXBhcnNlcicpO1xuXG5cbmlmICh0eXBlb2YgUHJvbWlzZSAhPSAnZnVuY3Rpb24nKVxuICByZXF1aXJlKCdlczYtcHJvbWlzZScpLnBvbHlmaWxsKCk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFUTE9wdGlvbnMge1xuICB2YXJpYWJsZXM/OiBBVExIZWxwZXJzLklEaWN0aW9uYXJ5PGFueT47XG4gIHBhdGg/OiBzdHJpbmc7XG4gIGZpbGU/OiBzdHJpbmc7XG4gIGJhc2VVcmk/OiBzdHJpbmc7XG4gIGJhc2VVcmlQYXJhbWV0ZXJzPzogQVRMSGVscGVycy5JRGljdGlvbmFyeTxzdHJpbmc+O1xuICBzZWxmU2lnbmVkQ2VydDogYm9vbGVhbjtcbiAgcmFtbDoge1xuICAgIGNvdmVyYWdlOiBib29sZWFuO1xuICAgIHJlc291cmNlVHlwZXM6IGJvb2xlYW47XG4gICAgdHJhaXRzOiBib29sZWFuO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQVRMIHtcbiAgb3B0aW9uczogSUFUTE9wdGlvbnMgPSB7XG4gICAgdmFyaWFibGVzOiB7fSxcbiAgICBwYXRoOiBudWxsLFxuICAgIGZpbGU6IG51bGwsXG4gICAgc2VsZlNpZ25lZENlcnQ6IGZhbHNlLFxuICAgIHJhbWw6IHtcbiAgICAgIGNvdmVyYWdlOiB0cnVlLFxuICAgICAgcmVzb3VyY2VUeXBlczogdHJ1ZSxcbiAgICAgIHRyYWl0czogdHJ1ZVxuICAgIH1cbiAgfTtcblxuICByYW1sOiBSQU1MLmFwaTA4LkFwaSB8IFJBTUwuYXBpMTAuQXBpO1xuXG4gIHN1aXRlczogQVRMSGVscGVycy5JRGljdGlvbmFyeTxBVExIZWxwZXJzLkFUTFN1aXRlPiA9IHt9O1xuXG4gIHNjaGVtYXM6IEFUTEhlbHBlcnMuSURpY3Rpb25hcnk8YW55PiA9IHt9O1xuXG4gIGZyb21PYmplY3Qob2JqZWN0OiBhbnkpIHtcbiAgICBpZiAodHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIilcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJmcm9tT2JqZWN0OiB0aGUgZmlyc3QgcGFyYW1ldGVyIG11c3QgYmUgYW4gb2JqZWN0XCIpO1xuXG4gICAgLy8gbWVyZ2UgdGhlIHZhcmlhYmxlc1xuICAgIGlmICgndmFyaWFibGVzJyBpbiBvYmplY3QpIHtcbiAgICAgIGlmICh0eXBlb2Ygb2JqZWN0LnZhcmlhYmxlcyAhPSBcIm9iamVjdFwiKVxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZnJvbU9iamVjdC52YXJpYWJsZXM6IE1VU1QgYmUgYW4gb2JqZWN0XCIpO1xuXG4gICAgICB0aGlzLm9wdGlvbnMudmFyaWFibGVzID0gXy5tZXJnZSh0aGlzLm9wdGlvbnMudmFyaWFibGVzIHx8IHt9LCBvYmplY3QudmFyaWFibGVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcHRpb25zLnZhcmlhYmxlcyA9IHRoaXMub3B0aW9ucy52YXJpYWJsZXMgfHwge307XG4gICAgfVxuXG4gICAgLy8gb3ZlcnJpZGUgdmFyaWFibGVzLkVOViBpZiBub3QgZXhpc3RzIG9yIGlzIGFuIG9iamVjdFxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMudmFyaWFibGVzWydFTlYnXSB8fCB0eXBlb2YgdGhpcy5vcHRpb25zLnZhcmlhYmxlc1snRU5WJ10gIT0gXCJvYmplY3RcIilcbiAgICAgIHRoaXMub3B0aW9ucy52YXJpYWJsZXNbJ0VOViddID0ge307XG5cbiAgICBfLmV4dGVuZCh0aGlzLm9wdGlvbnMudmFyaWFibGVzWydFTlYnXSwgXy5jbG9uZURlZXAocHJvY2Vzcy5lbnYpKTtcblxuICAgIC8vIHByZXBhcmUgdGhlIGJhc2VVcmlcbiAgICBpZiAoJ2Jhc2VVcmknIGluIG9iamVjdCkge1xuICAgICAgaWYgKHR5cGVvZiBvYmplY3QuYmFzZVVyaSA9PSBcInN0cmluZ1wiKVxuICAgICAgICB0aGlzLm9wdGlvbnMuYmFzZVVyaSA9IG9iamVjdC5iYXNlVXJpO1xuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYmFzZVVyaTogaW52YWxpZCB0eXBlXCIpO1xuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmJhc2VVcmkuc3Vic3RyKC0xKSA9PT0gJy8nKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5iYXNlVXJpID0gdGhpcy5vcHRpb25zLmJhc2VVcmkuc3Vic3RyKDAsIHRoaXMub3B0aW9ucy5iYXNlVXJpLmxlbmd0aCAtIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgnb3B0aW9ucycgaW4gb2JqZWN0KSB7XG4gICAgICBBVExIZWxwZXJzLmVuc3VyZUluc3RhbmNlT2YoXCJvcHRpb25zXCIsIG9iamVjdC5vcHRpb25zLCBPYmplY3QpO1xuXG4gICAgICBPYmplY3Qua2V5cyhvYmplY3Qub3B0aW9ucykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBsZXQgdmFsdWUgPSBvYmplY3Qub3B0aW9uc1trZXldO1xuXG4gICAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgICAgY2FzZSAnc2VsZlNpZ25lZENlcnQnOlxuICAgICAgICAgICAgQVRMSGVscGVycy5lbnN1cmVJbnN0YW5jZU9mKFwib3B0aW9ucy5zZWxmU2lnbmVkQ2VydFwiLCB2YWx1ZSwgQm9vbGVhbik7XG4gICAgICAgICAgICB0aGlzLm9wdGlvbnMuc2VsZlNpZ25lZENlcnQgPSAhIXZhbHVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncmFtbCc6XG4gICAgICAgICAgICBBVExIZWxwZXJzLmVuc3VyZUluc3RhbmNlT2YoXCJvcHRpb25zLnJhbWxcIiwgdmFsdWUsIE9iamVjdCk7XG4gICAgICAgICAgICBfLm1lcmdlKHRoaXMub3B0aW9ucy5yYW1sLCB2YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInVua25vd24gb3B0aW9uOlwiICsga2V5KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCdiYXNlVXJpUGFyYW1ldGVycycgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAoIW9iamVjdC5iYXNlVXJpUGFyYW1ldGVycyB8fCB0eXBlb2Ygb2JqZWN0LmJhc2VVcmlQYXJhbWV0ZXJzICE9IFwib2JqZWN0XCIgfHwgb2JqZWN0LmJhc2VVcmlQYXJhbWV0ZXJzIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJiYXNlVXJpUGFyYW1ldGVyczogTVVTVCBiZSBhIGRpY3Rpb25hcnlcIik7XG5cbiAgICAgIHRoaXMub3B0aW9ucy5iYXNlVXJpUGFyYW1ldGVycyA9IF8uY2xvbmVEZWVwKG9iamVjdC5iYXNlVXJpUGFyYW1ldGVycyk7XG4gICAgfVxuXG4gICAgLy8gcGFyc2UgdGhlIHRlc3RzXG4gICAgaWYgKCd0ZXN0cycgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAoIW9iamVjdC50ZXN0cyB8fCB0eXBlb2Ygb2JqZWN0LnRlc3RzICE9IFwib2JqZWN0XCIgfHwgb2JqZWN0LnRlc3RzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInRlc3RzOiBNVVNUIGJlIGEgZGljdGlvbmFyeVwiKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHN1aXRlOiBBVExIZWxwZXJzLkFUTFN1aXRlID0gbnVsbDtcblxuICAgICAgZm9yIChsZXQgc2VxdWVuY2VOYW1lIGluIG9iamVjdC50ZXN0cykge1xuICAgICAgICBzdWl0ZSA9IEFUTEhlbHBlcnMucGFyc2VTdWl0ZXMob2JqZWN0LnRlc3RzW3NlcXVlbmNlTmFtZV0sIHRoaXMpO1xuICAgICAgICBzdWl0ZS5uYW1lID0gc2VxdWVuY2VOYW1lO1xuXG4gICAgICAgIHRoaXMuc3VpdGVzW3N1aXRlLm5hbWVdID0gc3VpdGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCdzY2hlbWFzJyBpbiBvYmplY3QpIHtcbiAgICAgIGlmICghb2JqZWN0LnNjaGVtYXMgfHwgIShvYmplY3Quc2NoZW1hcyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2NoZW1hczogTVVTVCBiZSBhIGxpc3RcIik7XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IHNlcXVlbmNlTmFtZSBpbiBvYmplY3Quc2NoZW1hcykge1xuICAgICAgICBsZXQgc2NoZW1hTmFtZTogc3RyaW5nID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIG9iamVjdC5zY2hlbWFzW3NlcXVlbmNlTmFtZV0gPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIC8vIGxvYWQgc3RyaW5nIHNjaGVtYSBieSBwYXRoXG4gICAgICAgICAgLy8gVE9ETywgbG9hZCBzY2hlbWFcbiAgICAgICAgICB0aGlzLl9hZGRTY2hlbWEoc2VxdWVuY2VOYW1lLCB7fSk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0LnNjaGVtYXNbc2VxdWVuY2VOYW1lXSA9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgdGhpcy5fYWRkU2NoZW1hKHNjaGVtYU5hbWUsIG9iamVjdC5zY2hlbWFzW3NlcXVlbmNlTmFtZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJzY2hlbWFzOiBpbnZhbGlkIHNjaGVtYSBcIiArIHNlcXVlbmNlTmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoJ3JhbWwnIGluIG9iamVjdCkge1xuICAgICAgaWYgKCFvYmplY3QucmFtbCB8fCB0eXBlb2Ygb2JqZWN0LnJhbWwgIT0gXCJzdHJpbmdcIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicmFtbDogTVVTVCBiZSBhIHN0cmluZ1wiKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5yYW1sID0gUkFNTC5sb2FkQXBpU3luYyhvYmplY3QucmFtbCwgeyByZWplY3RPbkVycm9yczogdHJ1ZSB9KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKGUucGFyc2VyRXJyb3JzKSB7XG4gICAgICAgICAgZS5tZXNzYWdlID0gZS5tZXNzYWdlICsgXCJcXG5cIiArIGUucGFyc2VyRXJyb3JzLm1hcCh4ID0+IFwiICBcIiArIHgubWVzc2FnZSArIFwiIGxpbmUgXCIgKyB4LmxpbmUpLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2codXRpbC5pbnNwZWN0KGUpKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2NoZW1hcyA9IHRoaXMucmFtbC5zY2hlbWFzKCk7XG5cbiAgICAgIGZvciAobGV0IGkgaW4gc2NoZW1hcykge1xuICAgICAgICBsZXQgc2NoZW1hTGlzdCA9IHNjaGVtYXNbaV0udG9KU09OKCk7XG4gICAgICAgIGZvciAobGV0IHNjaGVtYU5hbWUgaW4gc2NoZW1hTGlzdCkge1xuICAgICAgICAgIGxldCBqc29uID0gbnVsbDtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAganNvbiA9IEpTT04ucGFyc2Uoc2NoZW1hTGlzdFtzY2hlbWFOYW1lXSk7XG4gICAgICAgICAgICB0aGlzLl9hZGRTY2hlbWEoc2NoZW1hTmFtZSwganNvbik7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZS5tZXNzYWdlID0gJ0Vycm9yIHBhcnNpbmcgSlNPTiBzY2hlbWEgJyArIHNjaGVtYU5hbWUgKyAnXFxuXFx0JyArIGUubWVzc2FnZSArICdcXG4nICsgdXRpbC5pbnNwZWN0KHNjaGVtYUxpc3Rbc2NoZW1hTmFtZV0pO1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBzdWl0ZUtleSBpbiB0aGlzLnN1aXRlcykge1xuICAgICAgdGhpcy5yZXBsYWNlU2NoZW1hKHRoaXMuc3VpdGVzW3N1aXRlS2V5XSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZXBsYWNlU2NoZW1hKHN1aXRlOiBBVExIZWxwZXJzLkFUTFN1aXRlKSB7XG4gICAgaWYgKHN1aXRlLnRlc3QgJiYgc3VpdGUudGVzdC5yZXNwb25zZS5ib2R5ICYmIHN1aXRlLnRlc3QucmVzcG9uc2UuYm9keS5zY2hlbWEpIHtcbiAgICAgIGlmICh0eXBlb2Ygc3VpdGUudGVzdC5yZXNwb25zZS5ib2R5LnNjaGVtYSA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGlmIChzdWl0ZS50ZXN0LnJlc3BvbnNlLmJvZHkuc2NoZW1hIGluIHRoaXMuc2NoZW1hcykge1xuICAgICAgICAgIHN1aXRlLnRlc3QucmVzcG9uc2UuYm9keS5zY2hlbWEgPSB0aGlzLnNjaGVtYXNbc3VpdGUudGVzdC5yZXNwb25zZS5ib2R5LnNjaGVtYV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzY2hlbWEgJyArIHN1aXRlLnRlc3QucmVzcG9uc2UuYm9keS5zY2hlbWEgKyAnIG5vdCBmb3VuZCBvbiB0ZXN0ICcgKyBzdWl0ZS50ZXN0Lm1ldGhvZCArICcgJyArIHN1aXRlLnRlc3QudXJpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdWl0ZS5zdWl0ZXMpIHtcbiAgICAgIGZvciAobGV0IHN1aXRlS2V5IGluIHN1aXRlLnN1aXRlcykge1xuICAgICAgICB0aGlzLnJlcGxhY2VTY2hlbWEoc3VpdGUuc3VpdGVzW3N1aXRlS2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkU2NoZW1hKHNjaGVtYU5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpIHtcbiAgICBpZiAoc2NoZW1hTmFtZSBpbiB0aGlzLnNjaGVtYXMpXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2NoZW1hczogZHVwbGljYXRlZCBzY2hlbWEgXCIgKyBzY2hlbWFOYW1lKTtcblxuICAgIC8vIFZBTElEQVRFIFNDSEVNQVxuXG4gICAgdGhpcy5zY2hlbWFzW3NjaGVtYU5hbWVdID0gc2NoZW1hO1xuICB9XG59Il19