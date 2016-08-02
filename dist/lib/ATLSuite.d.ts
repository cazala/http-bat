import { ATL } from './ATL';
import { ATLTest } from './ATLTest';
export declare class ATLSuite {
    name: string;
    constructor(name: string);
    suites: ATLSuite[];
    async: boolean;
    descriptor: any;
    test: ATLTest;
    skip: boolean;
    atl: ATL;
    soft: boolean;
}
export default ATLSuite;
