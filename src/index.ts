/**
 * CAIE Pseudocode Interpreter - Main Entry Point
 *
 * This module exports the main components of the CAIE pseudocode interpreter.
 */

// Main interpreter
export { Interpreter, InterpreterOptions, ExecutionResult } from './interpreter';

// CLI module
export { CLIInterface, CLIOptions, NodeCLIAdapter, runCLI, main } from './cli/node-index';

// IO Interface
export { IOInterface } from './io/io-interface';
export { NodeIOImpl } from './io/node-io-impl';

// Import for convenience functions
import { Interpreter as InterpreterClass, InterpreterOptions as InterpreterOptionsType, ExecutionResult as ExecutionResultType } from './interpreter';
import { IOInterface as IOInterfaceType } from './io/io-interface';
import { NodeIOImpl as NodeIOImplClass } from './io/node-io-impl';

// Type System
export {
	PseudocodeType,
	PSEUDOCODE_TO_TYPESCRIPT_MAPPING,
	TypeValidator,
	ArrayTypeInfo,
	UserDefinedTypeInfo,
	VariableInfo,
	ParameterMode,
	ParameterInfo,
	RoutineSignature
} from './types';

// Lexer
export {
	TokenType,
	KEYWORD_TOKENS,
	OPERATOR_TOKENS,
	DELIMITER_TOKENS,
	Token,
	TokenFactory
} from './lexer/tokens';
export { Lexer } from './lexer/lexer';

// Parser
export {
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
	BaseASTVisitor
} from './parser/ast-nodes';
export { Parser } from './parser/parser';

// Runtime components
export {
	Environment,
	ExecutionContext,
	RuntimeValue,
	RoutineInfo,
	CallFrame
} from './runtime/environment';
export { Evaluator } from './runtime/evaluator';

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
	ErrorLocation,
	ContextualError
} from './errors';

/**
 * Convenience function to create a new interpreter with default options
 */
export function createInterpreter(io?: IOInterfaceType, options?: InterpreterOptionsType): InterpreterClass {
	const ioImpl = io || new NodeIOImplClass();
	return new InterpreterClass(ioImpl, options);
}

/**
 * Convenience function to execute pseudocode source code
 */
export async function execute(sourceCode: string, options?: InterpreterOptionsType): Promise<ExecutionResultType> {
	const io = new NodeIOImplClass();
	const interpreter = new InterpreterClass(io, options);
	const result = await interpreter.execute(sourceCode);
	await interpreter.dispose();
	return result;
}

/**
 * Convenience function to execute a pseudocode file
 */
export async function executeFile(filePath: string, options?: InterpreterOptionsType): Promise<ExecutionResultType> {
	const io = new NodeIOImplClass();
	const interpreter = new InterpreterClass(io, options);
	const result = await interpreter.executeFile(filePath);
	await interpreter.dispose();
	return result;
}
