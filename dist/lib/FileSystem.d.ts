export interface IFSResolver {
    content(path: string): string;
    contentAsync(path: string): Promise<string>;
}
export declare class FSResolver implements IFSResolver {
    basePath: string;
    constructor(basePath?: string);
    content(path: string): string;
    contentAsync(path: string): Promise<string>;
}
export declare const DefaultFileResolver: FSResolver;
export declare class IncludedFile {
    path: string;
    constructor(path: string);
    content(fsResolver?: IFSResolver): string;
    contentAsync(fsResolver?: IFSResolver): Promise<string>;
    static getInstance(path: string): IncludedFile;
}
