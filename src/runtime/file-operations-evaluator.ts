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
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { RuntimeAsyncResult, toRuntimeError } from "../result";

export interface FileOperationExecutionContext {
    evaluateExpression(expression: ExpressionNode): RuntimeAsyncResult<unknown>;
    assignToTarget(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): RuntimeAsyncResult<void>;
    serializeRecord(value: unknown): string;
    deserializeRecord(data: string, target: ExpressionNode): RuntimeAsyncResult<void>;
}

export class FileOperationEvaluator {
    constructor(
        private readonly fileManager: RuntimeFileManager,
        private readonly ctx: FileOperationExecutionContext,
    ) {}

    openFileR(node: OpenFileNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                ResultAsync.fromPromise(
                    this.fileManager.open(fileIdentifier, node.mode),
                    (error: unknown) =>
                        new FileIOError(
                            `Failed to open file '${fileIdentifier}': ${
                                error instanceof Error ? error.message : "Unknown error"
                            }`,
                            node.line,
                            node.column,
                        ),
                ),
        );
    }

    closeFileR(node: CloseFileNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                ResultAsync.fromPromise(
                    this.fileManager.close(fileIdentifier),
                    (error: unknown) =>
                        new FileIOError(
                            `Failed to close file: ${String(error)}`,
                            node.line,
                            node.column,
                        ),
                ),
        );
    }

    readFileR(node: ReadFileNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                ResultAsync.fromPromise(
                    Promise.resolve(this.fileManager.readLine(fileIdentifier)),
                    (error: unknown) =>
                        new FileIOError(
                            `Failed to read file: ${String(error)}`,
                            node.line,
                            node.column,
                        ),
                ).andThen((content) =>
                    this.ctx.assignToTarget(node.target, content, node.line, node.column),
                ),
        );
    }

    writeFileR(node: WriteFileNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                ResultAsync.combine(
                    node.expressions.map((expression) =>
                        this.ctx.evaluateExpression(expression).map((value) => String(value)),
                    ),
                ).andThen((content) =>
                    this.trySync(
                        () => {
                            this.fileManager.writeLine(fileIdentifier, content.join(""));
                        },
                        node.line,
                        node.column,
                        "Failed to write file",
                    ),
                ),
        );
    }

    seekR(node: SeekNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                this.ctx.evaluateExpression(node.position).andThen((position) =>
                    this.trySync(
                        () => {
                            this.fileManager.seek(fileIdentifier, Number(position));
                        },
                        node.line,
                        node.column,
                        "Failed to seek in file",
                    ),
                ),
        );
    }

    getRecordR(node: GetRecordNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                ResultAsync.fromPromise(
                    this.fileManager.getRecord(fileIdentifier),
                    (error: unknown) =>
                        new FileIOError(
                            `Failed to get record: ${String(error)}`,
                            node.line,
                            node.column,
                        ),
                ).andThen((data) =>
                    this.ctx.deserializeRecord(data, node.target),
                ),
        );
    }

    putRecordR(node: PutRecordNode): RuntimeAsyncResult<void> {
        return this.evaluateFileIdentifierR(node.fileIdentifier, node.line, node.column).andThen(
            (fileIdentifier) =>
                this.ctx
                    .evaluateExpression(node.source)
                    .andThen((source) => {
                        const serialized = this.ctx.serializeRecord(source);
                        return ResultAsync.fromPromise(
                            this.fileManager.putRecord(fileIdentifier, serialized),
                            (error: unknown) =>
                                new FileIOError(
                                    `Failed to put record: ${String(error)}`,
                                    node.line,
                                    node.column,
                                ),
                        );
                    }),
        );
    }

    evaluateEOFCallR(
        args: ExpressionNode[],
        line?: number,
        column?: number,
    ): RuntimeAsyncResult<boolean> {
        if (args.length !== 1) {
            return errAsync(new RuntimeError("EOF expects exactly one argument", line, column));
        }
        return this.evaluateFileIdentifierR(args[0], line, column).andThen((identifier) =>
            ResultAsync.fromPromise(
                Promise.resolve(this.fileManager.isEOF(identifier)),
                (error: unknown) => toRuntimeError(error, line, column),
            ),
        );
    }

    private evaluateFileIdentifierR(
        expression: ExpressionNode,
        line?: number,
        column?: number,
    ): RuntimeAsyncResult<string> {
        return this.ctx.evaluateExpression(expression).andThen((value) => {
            if (typeof value !== "string") {
                return errAsync(
                    new RuntimeError("File identifier must evaluate to STRING", line, column),
                );
            }
            return okAsync(value);
        });
    }

    private trySync<T>(
        fn: () => T,
        line: number | undefined,
        column: number | undefined,
        messagePrefix: string,
    ): RuntimeAsyncResult<T> {
        try {
            return okAsync(fn());
        } catch (error) {
            return errAsync(new FileIOError(`${messagePrefix}: ${String(error)}`, line, column));
        }
    }

    async openFile(node: OpenFileNode): Promise<void> {
        const result = await this.openFileR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async closeFile(node: CloseFileNode): Promise<void> {
        const result = await this.closeFileR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async readFile(node: ReadFileNode): Promise<void> {
        const result = await this.readFileR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async writeFile(node: WriteFileNode): Promise<void> {
        const result = await this.writeFileR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async seek(node: SeekNode): Promise<void> {
        const result = await this.seekR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async getRecord(node: GetRecordNode): Promise<void> {
        const result = await this.getRecordR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async putRecord(node: PutRecordNode): Promise<void> {
        const result = await this.putRecordR(node);
        if (result.isErr()) {
            throw result.error;
        }
    }

    async evaluateEOFCall(
        args: ExpressionNode[],
        line?: number,
        column?: number,
    ): Promise<boolean> {
        const result = await this.evaluateEOFCallR(args, line, column);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value;
    }
}
