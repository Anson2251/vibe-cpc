import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { FileIOError } from "../errors";
import { RuntimeFileManager, FileMode } from "./file-manager";

export type IOOperation =
    | { type: "open"; fileIdentifier: string; mode: FileMode; line?: number; column?: number }
    | { type: "close"; fileIdentifier: string; line?: number; column?: number }
    | {
          type: "read";
          fileIdentifier: string;
          target: (content: string) => void;
          line?: number;
          column?: number;
      }
    | {
          type: "write";
          fileIdentifier: string;
          values: string[];
          line?: number;
          column?: number;
      }
    | {
          type: "seek";
          fileIdentifier: string;
          position: number;
          line?: number;
          column?: number;
      }
    | {
          type: "getRecord";
          fileIdentifier: string;
          target: (data: string) => void;
          line?: number;
          column?: number;
      }
    | {
          type: "putRecord";
          fileIdentifier: string;
          data: string;
          line?: number;
          column?: number;
      }
    | {
          type: "eof";
          fileIdentifier: string;
          target: (isEof: boolean) => void;
          line?: number;
          column?: number;
      };

export class IOQueue {
    private queue: IOOperation[] = [];
    private processing = false;
    private error: Error | null = null;

    constructor(private readonly fileManager: RuntimeFileManager) {}

    enqueue(operation: IOOperation): void {
        this.queue.push(operation);
        void this.processQueue();
    }

    async execute(operation: IOOperation): Promise<ResultAsync<void, FileIOError>> {
        return this.executeOperation(operation);
    }

    hasErrors(): boolean {
        return this.error !== null;
    }

    getError(): Error | null {
        return this.error;
    }

    clearError(): void {
        this.error = null;
    }

    async drain(): Promise<void> {
        while (this.queue.length > 0 || this.processing) {
            await this.processQueue();
            if (this.error) {
                throw this.error;
            }
        }
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && !this.error) {
            const operation = this.queue.shift()!;
            const result = await this.executeOperation(operation);

            if (result.isErr()) {
                this.error = result.error;
                break;
            }
        }

        this.processing = false;
    }

    private executeOperation(operation: IOOperation): ResultAsync<void, FileIOError> {
        switch (operation.type) {
            case "open":
                return this.executeOpen(operation);
            case "close":
                return this.executeClose(operation);
            case "read":
                return this.executeRead(operation);
            case "write":
                return this.executeWrite(operation);
            case "seek":
                return this.executeSeek(operation);
            case "getRecord":
                return this.executeGetRecord(operation);
            case "putRecord":
                return this.executePutRecord(operation);
            case "eof":
                return this.executeEOF(operation);
        }
    }

    private executeOpen(
        operation: Extract<IOOperation, { type: "open" }>,
    ): ResultAsync<void, FileIOError> {
        return ResultAsync.fromPromise(
            this.fileManager.open(operation.fileIdentifier, operation.mode),
            (error: unknown) =>
                new FileIOError(
                    `Failed to open file '${operation.fileIdentifier}': ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                    operation.line,
                    operation.column,
                ),
        );
    }

    private executeClose(
        operation: Extract<IOOperation, { type: "close" }>,
    ): ResultAsync<void, FileIOError> {
        return ResultAsync.fromPromise(
            this.fileManager.close(operation.fileIdentifier),
            (error: unknown) =>
                new FileIOError(
                    `Failed to close file: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
        );
    }

    private executeRead(
        operation: Extract<IOOperation, { type: "read" }>,
    ): ResultAsync<void, FileIOError> {
        try {
            const content = this.fileManager.readLine(operation.fileIdentifier);
            operation.target(content);
            return okAsync(undefined);
        } catch (error) {
            return errAsync(
                new FileIOError(
                    `Failed to read file: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
            );
        }
    }

    private executeWrite(
        operation: Extract<IOOperation, { type: "write" }>,
    ): ResultAsync<void, FileIOError> {
        try {
            this.fileManager.writeLine(operation.fileIdentifier, operation.values.join(""));
            return okAsync(undefined);
        } catch (error) {
            return errAsync(
                new FileIOError(
                    `Failed to write file: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
            );
        }
    }

    private executeSeek(
        operation: Extract<IOOperation, { type: "seek" }>,
    ): ResultAsync<void, FileIOError> {
        try {
            this.fileManager.seek(operation.fileIdentifier, operation.position);
            return okAsync(undefined);
        } catch (error) {
            return errAsync(
                new FileIOError(
                    `Failed to seek in file: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
            );
        }
    }

    private executeGetRecord(
        operation: Extract<IOOperation, { type: "getRecord" }>,
    ): ResultAsync<void, FileIOError> {
        return ResultAsync.fromPromise(
            this.fileManager.getRecord(operation.fileIdentifier),
            (error: unknown) =>
                new FileIOError(
                    `Failed to get record: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
        ).andThen((data) => {
            operation.target(data);
            return okAsync(undefined);
        });
    }

    private executePutRecord(
        operation: Extract<IOOperation, { type: "putRecord" }>,
    ): ResultAsync<void, FileIOError> {
        return ResultAsync.fromPromise(
            this.fileManager.putRecord(operation.fileIdentifier, operation.data),
            (error: unknown) =>
                new FileIOError(
                    `Failed to put record: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
        );
    }

    private executeEOF(
        operation: Extract<IOOperation, { type: "eof" }>,
    ): ResultAsync<void, FileIOError> {
        try {
            const isEof = this.fileManager.isEOF(operation.fileIdentifier);
            operation.target(isEof);
            return okAsync(undefined);
        } catch (error) {
            return errAsync(
                new FileIOError(
                    `Failed to check EOF: ${String(error)}`,
                    operation.line,
                    operation.column,
                ),
            );
        }
    }
}
