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
    createRunner(app?: any): ATLRunner;
    run(app?: any): ATLRunner;
    allTests(): ATLTest[];
}
export default Bat;
