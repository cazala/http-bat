export interface ILineMapper {
    position(pos: number): ITextPosition;
}
export interface ITextPosition {
    /**
     * Line number, starting from one
     */
    line: number;
    /**
     * Column number, starting from one
     */
    column: number;
    /**
     * Character index in whole text, starting from zero
     */
    position: number;
}
export declare class LineMapper implements ILineMapper {
    private content;
    private absPath;
    constructor(content: string, absPath: string);
    private mapping;
    position(_pos: number): ITextPosition;
    initMapping(): void;
}
