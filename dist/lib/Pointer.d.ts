export declare const type: any;
export declare class Pointer {
    path: string;
    constructor(path: string);
    set(object: any, value: any): void;
    get(object: any): {};
    inspect(): string;
    toString(): string;
}
