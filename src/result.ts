import { Result, ResultAsync } from "neverthrow";
import { PseudocodeError, RuntimeError, SyntaxError } from "./errors";

export type ParseResult<T> = Result<T, SyntaxError>;
export type RuntimeResult<T> = Result<T, RuntimeError>;
export type RuntimeAsyncResult<T> = ResultAsync<T, RuntimeError>;
export type InterpreterResult<T> = Result<T, PseudocodeError>;
export type InterpreterAsyncResult<T> = ResultAsync<T, PseudocodeError>;

export function toPseudocodeError(error: unknown): PseudocodeError {
    if (error instanceof PseudocodeError) {
        return error;
    }
    if (error instanceof Error) {
        return new PseudocodeError(error.message);
    }
    return new PseudocodeError(String(error));
}

export function toSyntaxError(error: unknown, line?: number, column?: number): SyntaxError {
    if (error instanceof SyntaxError) {
        return error;
    }
    if (error instanceof Error) {
        return new SyntaxError(error.message, line, column);
    }
    return new SyntaxError(String(error), line, column);
}

export function toRuntimeError(error: unknown, line?: number, column?: number): RuntimeError {
    if (error instanceof RuntimeError) {
        if (error.line === undefined && line !== undefined) {
            return new RuntimeError(error.message, line, error.column ?? column);
        }
        if (error.column === undefined && column !== undefined && error.line !== undefined) {
            return new RuntimeError(error.message, error.line, column);
        }
        return error;
    }
    if (error instanceof Error) {
        return new RuntimeError(error.message, line, column);
    }
    return new RuntimeError(String(error), line, column);
}
