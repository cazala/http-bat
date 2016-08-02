import { ATLSuite } from './ATLSuite';
import { Pointer } from './Pointer';
import { IDictionary } from './ATLHelpers';
import { KeyValueObject, ASTParser } from './YAML';
export interface IATLTestRes {
    status?: number;
    body?: {
        lowLevelNode?: ASTParser.YAMLNode;
        is?: any;
        matches?: KeyValueObject<any>[];
        take?: KeyValueObject<Pointer>[];
        copyTo?: Pointer;
        schema?: any;
        print?: boolean;
    };
    headers?: IDictionary<string>;
    print?: boolean;
    lowLevelNode?: ASTParser.YAMLNode;
}
export interface IATLTestReq {
    attach?: KeyValueObject<string>[];
    form?: KeyValueObject<any>[];
    json?: any;
    urlencoded?: KeyValueObject<any>[];
    queryParameters?: IDictionary<any>;
    headers?: IDictionary<any>;
    lowLevelNode?: ASTParser.YAMLNode;
}
export declare class ATLTest {
    suite: ATLSuite;
    wrapperSuite: ATLSuite;
    description: string;
    testId: string;
    method: string;
    uri: string;
    uriParameters: IDictionary<any>;
    timeout: number;
    response: IATLTestRes;
    request: IATLTestReq;
    result: any;
    lowLevelNode: ASTParser.YAMLNode;
}
export default ATLTest;
