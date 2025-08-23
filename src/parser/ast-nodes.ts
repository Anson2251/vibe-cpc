/**
 * AST Node Definitions for CAIE Pseudocode Parser
 *
 * This module defines all abstract syntax tree (AST) node types for the CAIE pseudocode language.
 */

import { PseudocodeType, ArrayTypeInfo, UserDefinedTypeInfo, ParameterMode } from '../types';

/**
 * Base interface for all AST nodes
 */
export interface ASTNode {
	type: string;
	line?: number;
	column?: number;
}

/**
 * Base interface for all statement nodes
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StatementNode extends ASTNode {
	// Marker interface for statements
}

/**
 * Base interface for all expression nodes
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExpressionNode extends ASTNode {
	// Marker interface for expressions
}

/**
 * Program node representing the entire pseudocode program
 */
export interface ProgramNode extends ASTNode {
	type: 'Program';
	body: StatementNode[];
}

// Statement node types

/**
 * Variable declaration statement
 */
export interface VariableDeclarationNode extends StatementNode {
	type: 'VariableDeclaration';
	name: string;
	dataType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
	isConstant: boolean;
	initialValue?: ExpressionNode;
}

/**
 * DECLARE statement
 */
export interface DeclareStatementNode extends StatementNode {
	type: 'DeclareStatement';
	name: string;
	dataType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
	isConstant: boolean;
	initialValue?: ExpressionNode;
}

/**
 * Assignment statement
 */
export interface AssignmentNode extends StatementNode {
	type: 'Assignment';
	target: ExpressionNode;  // Identifier or array access
	value: ExpressionNode;
}

/**
 * If-Then-Else statement
 */
export interface IfNode extends StatementNode {
	type: 'If';
	condition: ExpressionNode;
	thenBranch: StatementNode[];
	elseBranch?: StatementNode[];
}

/**
 * Case statement
 */
export interface CaseNode extends StatementNode {
	type: 'Case';
	expression: ExpressionNode;
	cases: { values: ExpressionNode[], body: StatementNode[] }[];
	otherwise?: StatementNode[];
}

/**
 * For-To-Next loop
 */
export interface ForNode extends StatementNode {
	type: 'For';
	variable: string;
	start: ExpressionNode;
	end: ExpressionNode;
	step?: ExpressionNode;
	body: StatementNode[];
}

/**
 * While-EndWhile loop
 */
export interface WhileNode extends StatementNode {
	type: 'While';
	condition: ExpressionNode;
	body: StatementNode[];
}

/**
 * Repeat-Until loop
 */
export interface RepeatNode extends StatementNode {
	type: 'Repeat';
	body: StatementNode[];
	condition: ExpressionNode;
}

/**
 * Procedure declaration
 */
export interface ProcedureDeclarationNode extends StatementNode {
	type: 'ProcedureDeclaration';
	name: string;
	parameters: ParameterNode[];
	body: StatementNode[];
}

/**
 * Function declaration
 */
export interface FunctionDeclarationNode extends StatementNode {
	type: 'FunctionDeclaration';
	name: string;
	parameters: ParameterNode[];
	returnType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
	body: StatementNode[];
}

/**
 * Call statement (for procedures)
 */
export interface CallStatementNode extends StatementNode {
	type: 'CallStatement';
	name: string;
	arguments: ExpressionNode[];
}

/**
 * Input statement
 */
export interface InputNode extends StatementNode {
	type: 'Input';
	prompt?: ExpressionNode;
	target: IdentifierNode | ArrayAccessNode;  // Identifier or array access
}

/**
 * Output statement
 */
export interface OutputNode extends StatementNode {
	type: 'Output';
	expressions: ExpressionNode[];
}

/**
 * Return statement (for functions)
 */
export interface ReturnNode extends StatementNode {
	type: 'Return';
	value?: ExpressionNode;
}

/**
 * Open file statement
 */
export interface OpenFileNode extends StatementNode {
	type: 'OpenFile';
	filename: ExpressionNode;
	mode: 'READ' | 'WRITE' | 'APPEND' | 'RANDOM';
	fileHandle: ExpressionNode;  // Identifier
}

/**
 * Close file statement
 */
export interface CloseFileNode extends StatementNode {
	type: 'CloseFile';
	fileHandle: ExpressionNode;  // Identifier
}

/**
 * Read file statement
 */
export interface ReadFileNode extends StatementNode {
	type: 'ReadFile';
	fileHandle: ExpressionNode;  // Identifier
	target: ExpressionNode;  // Identifier or array access
}

/**
 * Write file statement
 */
export interface WriteFileNode extends StatementNode {
	type: 'WriteFile';
	fileHandle: ExpressionNode;  // Identifier
	expressions: ExpressionNode[];
}

/**
 * Seek statement (for random file access)
 */
export interface SeekNode extends StatementNode {
	type: 'Seek';
	fileHandle: ExpressionNode;  // Identifier
	position: ExpressionNode;
}

/**
 * Get record statement (for random file access)
 */
export interface GetRecordNode extends StatementNode {
	type: 'GetRecord';
	fileHandle: ExpressionNode;  // Identifier
	position: ExpressionNode;
	target: ExpressionNode;  // Identifier or array access
}

/**
 * Put record statement (for random file access)
 */
export interface PutRecordNode extends StatementNode {
	type: 'PutRecord';
	fileHandle: ExpressionNode;  // Identifier
	position: ExpressionNode;
	source: ExpressionNode;  // Identifier or array access
}

/**
 * Type declaration (user-defined type)
 */
export interface TypeDeclarationNode extends StatementNode {
	type: 'TypeDeclaration';
	name: string;
	fields: FieldDeclarationNode[];
}

/**
 * Field declaration within a user-defined type
 */
export interface FieldDeclarationNode extends StatementNode {
	type: 'FieldDeclaration';
	name: string;
	dataType: PseudocodeType | ArrayTypeInfo;
}

/**
 * Class declaration
 */
export interface ClassDeclarationNode extends StatementNode {
	type: 'ClassDeclaration';
	name: string;
	inherits?: string;  // Parent class name
	fields: FieldDeclarationNode[];
	methods: MethodDeclarationNode[];
}

/**
 * Method declaration within a class
 */
export interface MethodDeclarationNode extends StatementNode {
	type: 'MethodDeclaration';
	name: string;
	visibility: 'PUBLIC' | 'PRIVATE';
	parameters: ParameterNode[];
	returnType?: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
	body: StatementNode[];
}

// Expression node types

/**
 * Binary expression (e.g., a + b, x > y)
 */
export interface BinaryExpressionNode extends ExpressionNode {
	type: 'BinaryExpression';
	operator: string;
	left: ExpressionNode;
	right: ExpressionNode;
}

/**
 * Unary expression (e.g., -x, NOT a)
 */
export interface UnaryExpressionNode extends ExpressionNode {
	type: 'UnaryExpression';
	operator: string;
	operand: ExpressionNode;
}

/**
 * Identifier expression (variable or function name)
 */
export interface IdentifierNode extends ExpressionNode {
	type: 'Identifier';
	name: string;
}

/**
 * Literal expression (constant value)
 */
export interface LiteralNode extends ExpressionNode {
	type: 'Literal';
	value: unknown;
	dataType: PseudocodeType;
}

/**
 * Array access expression (e.g., arr[1], matrix[2][3])
 */
export interface ArrayAccessNode extends ExpressionNode {
	type: 'ArrayAccess';
	array: ExpressionNode;
	indices: ExpressionNode[];
}

/**
 * Function call expression
 */
export interface CallExpressionNode extends ExpressionNode {
	type: 'CallExpression';
	name: string;
	arguments: ExpressionNode[];
}

/**
 * Member access expression (e.g., obj.field)
 */
export interface MemberAccessNode extends ExpressionNode {
	type: 'MemberAccess';
	object: ExpressionNode;
	field: string;
}

/**
 * New expression (object instantiation)
 */
export interface NewExpressionNode extends ExpressionNode {
	type: 'NewExpression';
	className: string;
	arguments: ExpressionNode[];
}

/**
 * Type cast expression
 */
export interface TypeCastNode extends ExpressionNode {
	type: 'TypeCast';
	targetType: PseudocodeType;
	expression: ExpressionNode;
}

// Helper node types

/**
 * Parameter node for procedure/function declarations
 */
export interface ParameterNode extends ASTNode {
	type: 'Parameter';
	name: string;
	dataType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
	mode: ParameterMode;
}

/**
 * Array type node
 */
export interface ArrayTypeNode extends ASTNode {
	type: 'ArrayType';
	elementType: PseudocodeType;
	dimensions: ExpressionNode[];  // Expression nodes for array bounds
}

/**
 * EOF marker node
 */
export interface EOFNode extends ASTNode {
	type: 'EOF';
}

/**
 * AST visitor interface for traversing the AST
 */
export interface ASTVisitor<T> {
	visit(node: ASTNode): T;

	visitProgram(node: ProgramNode): T;
	visitVariableDeclaration(node: VariableDeclarationNode): T;
	visitDeclareStatement(node: DeclareStatementNode): T;
	visitAssignment(node: AssignmentNode): T;
	visitIf(node: IfNode): T;
	visitCase(node: CaseNode): T;
	visitFor(node: ForNode): T;
	visitWhile(node: WhileNode): T;
	visitRepeat(node: RepeatNode): T;
	visitProcedureDeclaration(node: ProcedureDeclarationNode): T;
	visitFunctionDeclaration(node: FunctionDeclarationNode): T;
	visitCallStatement(node: CallStatementNode): T;
	visitInput(node: InputNode): T;
	visitOutput(node: OutputNode): T;
	visitReturn(node: ReturnNode): T;
	visitOpenFile(node: OpenFileNode): T;
	visitCloseFile(node: CloseFileNode): T;
	visitReadFile(node: ReadFileNode): T;
	visitWriteFile(node: WriteFileNode): T;
	visitSeek(node: SeekNode): T;
	visitGetRecord(node: GetRecordNode): T;
	visitPutRecord(node: PutRecordNode): T;
	visitTypeDeclaration(node: TypeDeclarationNode): T;
	visitFieldDeclaration(node: FieldDeclarationNode): T;
	visitClassDeclaration(node: ClassDeclarationNode): T;
	visitMethodDeclaration(node: MethodDeclarationNode): T;
	visitBinaryExpression(node: BinaryExpressionNode): T;
	visitUnaryExpression(node: UnaryExpressionNode): T;
	visitIdentifier(node: IdentifierNode): T;
	visitLiteral(node: LiteralNode): T;
	visitArrayAccess(node: ArrayAccessNode): T;
	visitCallExpression(node: CallExpressionNode): T;
	visitMemberAccess(node: MemberAccessNode): T;
	visitNewExpression(node: NewExpressionNode): T;
	visitTypeCast(node: TypeCastNode): T;
	visitParameter(node: ParameterNode): T;
	visitArrayType(node: ArrayTypeNode): T;
	visitEOF(node: EOFNode): T;
}

/**
 * Base AST visitor implementation with default behavior
 */
export abstract class BaseASTVisitor<T> implements ASTVisitor<T> {
	visit(node: ASTNode): T {
		switch (node.type) {
			case 'Program': return this.visitProgram(node as ProgramNode);
			case 'VariableDeclaration': return this.visitVariableDeclaration(node as VariableDeclarationNode);
			case 'DeclareStatement': return this.visitDeclareStatement(node as DeclareStatementNode);
			case 'Assignment': return this.visitAssignment(node as AssignmentNode);
			case 'If': return this.visitIf(node as IfNode);
			case 'Case': return this.visitCase(node as CaseNode);
			case 'For': return this.visitFor(node as ForNode);
			case 'While': return this.visitWhile(node as WhileNode);
			case 'Repeat': return this.visitRepeat(node as RepeatNode);
			case 'ProcedureDeclaration': return this.visitProcedureDeclaration(node as ProcedureDeclarationNode);
			case 'FunctionDeclaration': return this.visitFunctionDeclaration(node as FunctionDeclarationNode);
			case 'CallStatement': return this.visitCallStatement(node as CallStatementNode);
			case 'Input': return this.visitInput(node as InputNode);
			case 'Output': return this.visitOutput(node as OutputNode);
			case 'Return': return this.visitReturn(node as ReturnNode);
			case 'OpenFile': return this.visitOpenFile(node as OpenFileNode);
			case 'CloseFile': return this.visitCloseFile(node as CloseFileNode);
			case 'ReadFile': return this.visitReadFile(node as ReadFileNode);
			case 'WriteFile': return this.visitWriteFile(node as WriteFileNode);
			case 'Seek': return this.visitSeek(node as SeekNode);
			case 'GetRecord': return this.visitGetRecord(node as GetRecordNode);
			case 'PutRecord': return this.visitPutRecord(node as PutRecordNode);
			case 'TypeDeclaration': return this.visitTypeDeclaration(node as TypeDeclarationNode);
			case 'FieldDeclaration': return this.visitFieldDeclaration(node as FieldDeclarationNode);
			case 'ClassDeclaration': return this.visitClassDeclaration(node as ClassDeclarationNode);
			case 'MethodDeclaration': return this.visitMethodDeclaration(node as MethodDeclarationNode);
			case 'BinaryExpression': return this.visitBinaryExpression(node as BinaryExpressionNode);
			case 'UnaryExpression': return this.visitUnaryExpression(node as UnaryExpressionNode);
			case 'Identifier': return this.visitIdentifier(node as IdentifierNode);
			case 'Literal': return this.visitLiteral(node as LiteralNode);
			case 'ArrayAccess': return this.visitArrayAccess(node as ArrayAccessNode);
			case 'CallExpression': return this.visitCallExpression(node as CallExpressionNode);
			case 'MemberAccess': return this.visitMemberAccess(node as MemberAccessNode);
			case 'NewExpression': return this.visitNewExpression(node as NewExpressionNode);
			case 'TypeCast': return this.visitTypeCast(node as TypeCastNode);
			case 'Parameter': return this.visitParameter(node as ParameterNode);
			case 'ArrayType': return this.visitArrayType(node as ArrayTypeNode);
			case 'EOF': return this.visitEOF(node as EOFNode);
			default:
				throw new Error(`Unknown node type: ${node.type}`);
		}
	}

	// Default implementations for all visit methods
	abstract visitProgram(node: ProgramNode): T;
	abstract visitVariableDeclaration(node: VariableDeclarationNode): T;
	abstract visitDeclareStatement(node: DeclareStatementNode): T;
	abstract visitAssignment(node: AssignmentNode): T;
	abstract visitIf(node: IfNode): T;
	abstract visitCase(node: CaseNode): T;
	abstract visitFor(node: ForNode): T;
	abstract visitWhile(node: WhileNode): T;
	abstract visitRepeat(node: RepeatNode): T;
	abstract visitProcedureDeclaration(node: ProcedureDeclarationNode): T;
	abstract visitFunctionDeclaration(node: FunctionDeclarationNode): T;
	abstract visitCallStatement(node: CallStatementNode): T;
	abstract visitInput(node: InputNode): T;
	abstract visitOutput(node: OutputNode): T;
	abstract visitReturn(node: ReturnNode): T;
	abstract visitOpenFile(node: OpenFileNode): T;
	abstract visitCloseFile(node: CloseFileNode): T;
	abstract visitReadFile(node: ReadFileNode): T;
	abstract visitWriteFile(node: WriteFileNode): T;
	abstract visitSeek(node: SeekNode): T;
	abstract visitGetRecord(node: GetRecordNode): T;
	abstract visitPutRecord(node: PutRecordNode): T;
	abstract visitTypeDeclaration(node: TypeDeclarationNode): T;
	abstract visitFieldDeclaration(node: FieldDeclarationNode): T;
	abstract visitClassDeclaration(node: ClassDeclarationNode): T;
	abstract visitMethodDeclaration(node: MethodDeclarationNode): T;
	abstract visitBinaryExpression(node: BinaryExpressionNode): T;
	abstract visitUnaryExpression(node: UnaryExpressionNode): T;
	abstract visitIdentifier(node: IdentifierNode): T;
	abstract visitLiteral(node: LiteralNode): T;
	abstract visitArrayAccess(node: ArrayAccessNode): T;
	abstract visitCallExpression(node: CallExpressionNode): T;
	abstract visitMemberAccess(node: MemberAccessNode): T;
	abstract visitNewExpression(node: NewExpressionNode): T;
	abstract visitTypeCast(node: TypeCastNode): T;
	abstract visitParameter(node: ParameterNode): T;
	abstract visitArrayType(node: ArrayTypeNode): T;
	abstract visitEOF(node: EOFNode): T;
}
