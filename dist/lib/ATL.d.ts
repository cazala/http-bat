import ATLHelpers = require('./ATLHelpers');
import RAML = require('raml-1-parser');
import { ASTParser } from './YAML';
import { IFSResolver } from './FileSystem';
import ATLTest from './ATLTest';
import ATLSuite from './ATLSuite';
export interface IATLOptions {
    variables?: ATLHelpers.IDictionary<any>;
    path?: string;
    file?: string;
    baseUri?: string;
    baseUriParameters?: ATLHelpers.IDictionary<string>;
    selfSignedCert?: boolean;
    raml?: {
        coverage?: boolean;
        resourceTypes?: boolean;
        traits?: boolean;
    };
    FSResolver?: IFSResolver;
    loadAssets?: boolean;
}
export declare class ATL {
    static interprete: {
        baseUri(atl: ATL, node: ASTParser.YAMLNode): void;
        raml(atl: ATL, node: ASTParser.YAMLNode): void;
        variables(atl: ATL, node: ASTParser.YAMLNode): void;
        options(atl: ATL, node: ASTParser.YAMLNode): void;
        tests(atl: ATL, node: ASTParser.YAMLNode): void;
        schemas(atl: ATL, node: ASTParser.YAMLNode): void;
    };
    options: IATLOptions;
    constructor(options?: IATLOptions);
    raml: RAML.api08.Api | RAML.api10.Api;
    suites: ATLHelpers.IDictionary<ATLSuite>;
    schemas: ATLHelpers.IDictionary<any>;
    errors: any[];
    allTests(): ATLTest[];
    fromAST(astRoot: ASTParser.YAMLNode): void;
    obtainSchemaValidator(schema: any): (content: any) => {
        valid: boolean;
        errors: any[];
    };
    private replaceSchema(test);
    private _addSchema(schemaName, schema);
}
export default ATL;
