/**
 * CAIE Pseudocode Interpreter - Main Entry Point
 *
 * This module exports the main components of the CAIE pseudocode interpreter.
 */

// Main interpreter
export { Interpreter } from "./interpreter";
export type { InterpreterOptions, ExecutionResult } from "./interpreter";

// CLI module
export { NodeCLIAdapter, runCLI, main } from "./cli/node-index";
export type { CLIInterface, CLIOptions } from "./cli/node-index";

// IO Interface
export type { IOInterface } from "./io/io-interface";
export { NodeIOImpl } from "./io/node-io-impl";
export {
    BrowserIOImpl,
    type BrowserFileSystemAdapter,
    type BrowserIOOptions,
} from "./io/browser-io-impl";

// Import for convenience functions
import { Interpreter as InterpreterClass } from "./interpreter";
import type {
    InterpreterOptions as InterpreterOptionsType,
    ExecutionResult as ExecutionResultType,
} from "./interpreter";
import type { IOInterface as IOInterfaceType } from "./io/io-interface";
import { NodeIOImpl as NodeIOImplClass } from "./io/node-io-impl";

// Type System
export {
    PseudocodeType,
    PSEUDOCODE_TO_TYPESCRIPT_MAPPING,
    TypeValidator,
    ParameterMode,
} from "./types";
export type {
    ArrayTypeInfo,
    UserDefinedTypeInfo,
    VariableInfo,
    ParameterInfo,
    RoutineSignature,
    PointerTypeInfo,
    InferredTypeInfo,
} from "./types";

// Lexer
export {
    TokenType,
    KEYWORD_TOKENS,
    OPERATOR_TOKENS,
    DELIMITER_TOKENS,
    TokenFactory,
} from "./lexer/tokens";
export type { Token } from "./lexer/tokens";
export { Lexer } from "./lexer/lexer";

// Parser
export { BaseASTVisitor } from "./parser/ast-nodes";
export type {
    // Node types
    ProgramNode,
    VariableDeclarationNode,
    AssignmentNode,
    IfNode,
    ForNode,
    WhileNode,
    RepeatNode,
    ProcedureDeclarationNode,
    FunctionDeclarationNode,
    CallStatementNode,
    InputNode,
    OutputNode,
    ReturnNode,
    DebuggerNode,
    OpenFileNode,
    CloseFileNode,
    ReadFileNode,
    WriteFileNode,
    SeekNode,
    GetRecordNode,
    PutRecordNode,
    TypeDeclarationNode,
    FieldDeclarationNode,
    ClassDeclarationNode,
    MethodDeclarationNode,
    BinaryExpressionNode,
    UnaryExpressionNode,
    IdentifierNode,
    LiteralNode,
    ArrayAccessNode,
    CallExpressionNode,
    MemberAccessNode,
    NewExpressionNode,
    TypeCastNode,
    ParameterNode,
    ArrayTypeNode,
    EOFNode,

    // Visitor pattern
    ASTVisitor,
} from "./parser/ast-nodes";
export { Parser } from "./parser/parser";

// Runtime components
export { Environment, ExecutionContext } from "./runtime/environment";
export type { RuntimeValue, RoutineInfo, CallFrame } from "./runtime/environment";
export { Evaluator } from "./runtime/evaluator";
export { Heap, NULL_POINTER } from "./runtime/heap";
export type { HeapObject } from "./runtime/heap";
export { DebuggerController } from "./runtime/debugger";
export type {
    DebugEvent,
    DebugSnapshot,
    DebugPauseReason,
    DebugLocation,
    DebugScope,
    DebugVariable,
    DebugFrame,
    DebugBreakpointCondition,
    LineBreakpoint,
    BreakpointConditionValidationResult,
    BreakpointConditionErrorCode,
    BreakpointConditionErrorDetails,
} from "./runtime/debugger";

// Error handling
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

/**
 * Convenience function to create a new interpreter with default options
 */
export function createInterpreter(
    io?: IOInterfaceType,
    options?: InterpreterOptionsType,
): InterpreterClass {
    const ioImpl = io || new NodeIOImplClass();
    return new InterpreterClass(ioImpl, options);
}

/**
 * Convenience function to execute pseudocode source code
 */
export async function execute(
    sourceCode: string,
    options?: InterpreterOptionsType,
): Promise<ExecutionResultType> {
    const io = new NodeIOImplClass();
    const interpreter = new InterpreterClass(io, options);
    const result = await interpreter.execute(sourceCode);
    await interpreter.dispose();
    return result;
}

/**
 * Convenience function to execute a pseudocode file
 */
export async function executeFile(
    filePath: string,
    options?: InterpreterOptionsType,
): Promise<ExecutionResultType> {
    const io = new NodeIOImplClass();
    const interpreter = new InterpreterClass(io, options);
    const result = await interpreter.executeFile(filePath);
    await interpreter.dispose();
    return result;
}
