/**
 * Browser-focused module entry for CAIE Pseudocode Interpreter.
 *
 * This entry excludes Node CLI exports so bundlers can safely include it
 * in browser applications.
 */

export { Interpreter } from "./interpreter";
export type { InterpreterOptions, ExecutionResult } from "./interpreter";

export type { IOInterface } from "./io/io-interface";
export {
    BrowserIOImpl,
    type BrowserFileSystemAdapter,
    type BrowserIOOptions,
} from "./io/browser-io-impl";

export {
    DebuggerController,
    type DebugEvent,
    type DebugSnapshot,
    type DebugPauseReason,
    type DebugLocation,
    type DebugScope,
    type DebugVariable,
    type DebugFrame,
    type DebugBreakpointCondition,
    type LineBreakpoint,
    type BreakpointConditionValidationResult,
    type BreakpointConditionErrorCode,
    type BreakpointConditionErrorDetails,
} from "./runtime/debugger";

export type {
    TypeInfo,
    ArrayTypeInfo,
    ArrayBoundValue,
    UserDefinedTypeInfo,
    EnumTypeInfo,
    SetTypeInfo,
    PointerTypeInfo,
    InferredTypeInfo,
} from "./types";

export {
    PseudocodeError,
    SyntaxError,
    RuntimeError,
    TypeError,
    FileIOError,
    DivisionByZeroError,
    StackOverflowError,
    IndexError,
    NullReferenceError,
    ErrorHandler,
    ErrorRecovery,
    ContextualError,
} from "./errors";

export type { ErrorLocation } from "./errors";

// Export runtime types that may be needed
export type { RoutineInfo, RuntimeValue, CallFrame } from "./runtime/environment";
