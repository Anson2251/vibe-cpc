import {
    ExpressionNode,
    OpenFileNode,
    CloseFileNode,
    ReadFileNode,
    WriteFileNode,
    SeekNode,
    GetRecordNode,
    PutRecordNode,
} from "../parser/ast-nodes";
import { FileIOError, RuntimeError } from "../errors";
import { RuntimeFileManager } from "./file-manager";

export interface FileOperationExecutionContext {
    evaluateExpression(expression: ExpressionNode): Promise<unknown>;
    assignToTarget(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): Promise<void>;
    serializeRecord(value: unknown): string;
    deserializeRecord(data: string, target: ExpressionNode): Promise<void>;
}

export class FileOperationEvaluator {
    constructor(
        private readonly fileManager: RuntimeFileManager,
        private readonly ctx: FileOperationExecutionContext,
    ) {}

    async openFile(node: OpenFileNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            await this.fileManager.open(fileIdentifier, node.mode);
        } catch (error) {
            throw new FileIOError(
                `Failed to open file '${fileIdentifier}': ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                node.line,
                node.column,
            );
        }
    }

    async closeFile(node: CloseFileNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            await this.fileManager.close(fileIdentifier);
        } catch (error) {
            throw new FileIOError(`Failed to close file: ${String(error)}`, node.line, node.column);
        }
    }

    async readFile(node: ReadFileNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            const content = this.fileManager.readLine(fileIdentifier);
            await this.ctx.assignToTarget(node.target, content, node.line, node.column);
        } catch (error) {
            if (error instanceof FileIOError) throw error;
            throw new FileIOError(`Failed to read file: ${String(error)}`, node.line, node.column);
        }
    }

    async writeFile(node: WriteFileNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            const values = await Promise.all(
                node.expressions.map(async (expression) =>
                    String(await this.ctx.evaluateExpression(expression)),
                ),
            );
            this.fileManager.writeLine(fileIdentifier, values.join(""));
        } catch (error) {
            if (error instanceof FileIOError) throw error;
            throw new FileIOError(`Failed to write file: ${String(error)}`, node.line, node.column);
        }
    }

    async seek(node: SeekNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            const position = await this.ctx.evaluateExpression(node.position);
            this.fileManager.seek(fileIdentifier, Number(position));
        } catch (error) {
            if (error instanceof FileIOError) throw error;
            throw new FileIOError(
                `Failed to seek in file: ${String(error)}`,
                node.line,
                node.column,
            );
        }
    }

    async getRecord(node: GetRecordNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            const data = await this.fileManager.getRecord(fileIdentifier);
            await this.ctx.deserializeRecord(data, node.target);
        } catch (error) {
            if (error instanceof FileIOError) throw error;
            throw new FileIOError(`Failed to get record: ${String(error)}`, node.line, node.column);
        }
    }

    async putRecord(node: PutRecordNode): Promise<void> {
        const fileIdentifier = await this.evaluateFileIdentifier(
            node.fileIdentifier,
            node.line,
            node.column,
        );
        try {
            const source = await this.ctx.evaluateExpression(node.source);
            const serialized = this.ctx.serializeRecord(source);
            await this.fileManager.putRecord(fileIdentifier, serialized);
        } catch (error) {
            if (error instanceof FileIOError) throw error;
            throw new FileIOError(`Failed to put record: ${String(error)}`, node.line, node.column);
        }
    }

    async evaluateEOFCall(
        args: ExpressionNode[],
        line?: number,
        column?: number,
    ): Promise<boolean> {
        if (args.length !== 1) {
            throw new RuntimeError("EOF expects exactly one argument", line, column);
        }
        const identifier = await this.evaluateFileIdentifier(args[0], line, column);
        return this.fileManager.isEOF(identifier);
    }

    private async evaluateFileIdentifier(
        expression: ExpressionNode,
        line?: number,
        column?: number,
    ): Promise<string> {
        const value = await this.ctx.evaluateExpression(expression);
        if (typeof value !== "string") {
            throw new RuntimeError("File identifier must evaluate to STRING", line, column);
        }
        return value;
    }
}
