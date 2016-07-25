import { ATL } from './lib/ATL';
export import ATLHelpers = require('./lib/ATLHelpers');
export import Coverage = require('./lib/Coverage');
export import YAML = require('./lib/YAML');
import { RAMLCoverage } from './lib/Coverage';
export interface IBatOptions {
    baseUri?: string;
    variables?: ATLHelpers.IDictionary<any>;
    file?: string;
    raw?: string;
    loadAssets?: boolean;
}
export declare class Bat {
    options: IBatOptions;
    path: string;
    file: string;
    atl: ATL;
    RAMLCoverage: RAMLCoverage;
    errors: any[];
    constructor(options?: IBatOptions);
    private updateState();
    load(file: string): void;
    raw(content: string): void;
    run(app?: any): Promise<{
        success: boolean;
    }[]>;
    allTests(): ATLHelpers.ATLTest[];
}
export default Bat;
