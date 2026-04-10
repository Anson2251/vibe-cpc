/**
 * Runtime Evaluator for CAIE Pseudocode Interpreter
 *
 * This module implements the evaluator for executing AST nodes in the CAIE pseudocode language.
 * It interprets the abstract syntax tree and performs the operations specified by the pseudocode.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import {
	ASTNode,
	ProgramNode,
	StatementNode,
	ExpressionNode,
	VariableDeclarationNode,
	DeclareStatementNode,
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
	SetDeclarationNode,
	ClassDeclarationNode,
	BinaryExpressionNode,
	UnaryExpressionNode,
	IdentifierNode,
	LiteralNode,
	ArrayAccessNode,
	CallExpressionNode,
	MemberAccessNode,
	NewExpressionNode,
	TypeCastNode
} from '../parser/ast-nodes';

// Define CaseNode interface locally since it's not exported
interface CaseNode extends StatementNode {
	type: 'Case';
	expression: ExpressionNode;
	cases: { values: ExpressionNode[], body: StatementNode[] }[];
	otherwise?: StatementNode[];
}

import {
	PseudocodeType,
	ArrayTypeInfo,
	UserDefinedTypeInfo,
	EnumTypeInfo,
	SetTypeInfo,
	TypeInfo,
	ParameterMode
} from '../types';

import {
	RuntimeError,
	DivisionByZeroError,
	IndexError
} from '../errors';

import builtInFunctions from './builtin-functions';
import { RuntimeFileManager } from './file-manager';
import { FileOperationEvaluator } from './file-operations-evaluator';

import { Environment, ExecutionContext, RoutineInfo } from './environment';
import { IOInterface } from '../io/io-interface';
import { VariableAtom, ArrayAtom, UserDefinedAtom, VariableAtomFactory } from './variable-atoms';

/**
 * Evaluator class for executing AST nodes
 */
export class Evaluator {
	private environment: Environment;
	context: ExecutionContext;
	private io: IOInterface;
	private fileManager: RuntimeFileManager;
	private fileOperations: FileOperationEvaluator;
	private globalRoutines: Map<string, RoutineInfo> = new Map();
	private userDefinedTypes: Map<string, UserDefinedTypeInfo> = new Map();
	private enumTypes: Map<string, EnumTypeInfo> = new Map();
	private setTypes: Map<string, SetTypeInfo> = new Map();

	constructor(io: IOInterface) {
		this.io = io;
		this.environment = new Environment();
		this.context = new ExecutionContext(this.environment);
		this.fileManager = new RuntimeFileManager(io);
		this.fileOperations = new FileOperationEvaluator(this.fileManager, {
			evaluateExpression: async (expression) => this.evaluate(expression),
			assignToTarget: async (target, value, line, column) => this.assignValueToTarget(target, value, line, column)
		});
		this.initializeBuiltInRoutines();
	}

	/**
	 * Evaluate a program node
	 */
	async evaluateProgram(node: ProgramNode): Promise<unknown> {
		let result: unknown;

		for (const statement of node.body) {
			result = await this.evaluate(statement);

			// Check if we should return early
			if (this.context.shouldReturnFromRoutine()) {
				break;
			}
		}

		return result;
	}

	/**
	 * Evaluate a statement node
	 */
	async evaluate(node: ASTNode): Promise<unknown> {
		// Update current line and column for error reporting
		if (node.line !== undefined) {
			this.context.currentLine = node.line;
		}
		if (node.column !== undefined) {
			this.context.currentColumn = node.column;
		}

		switch (node.type) {
			case 'VariableDeclaration':
				await this.evaluateVariableDeclaration(node as VariableDeclarationNode);
				return undefined;

			case 'DeclareStatement':
				await this.evaluateDeclareStatement(node as DeclareStatementNode);
				return undefined;

			case 'Assignment':
				await this.evaluateAssignment(node as AssignmentNode);
				return undefined;

			case 'If':
				await this.evaluateIf(node as IfNode);
				return undefined;

			case 'Case':
				await this.evaluateCase(node as CaseNode);
				return undefined;

			case 'For':
				await this.evaluateFor(node as ForNode);
				return undefined;

			case 'While':
				await this.evaluateWhile(node as WhileNode);
				return undefined;

			case 'Repeat':
				await this.evaluateRepeat(node as RepeatNode);
				return undefined;

			case 'ProcedureDeclaration':
				this.evaluateProcedureDeclaration(node as ProcedureDeclarationNode);
				return undefined;

			case 'FunctionDeclaration':
				this.evaluateFunctionDeclaration(node as FunctionDeclarationNode);
				return undefined;

			case 'CallStatement':
				await this.evaluateCallStatement(node as CallStatementNode);
				return undefined;

			case 'Input':
				await this.evaluateInput(node as InputNode);
				return undefined;

			case 'Output':
				await this.evaluateOutput(node as OutputNode);
				return undefined;

			case 'Return':
				await this.evaluateReturn(node as ReturnNode);
				return undefined;

			case 'OpenFile':
				await this.fileOperations.openFile(node as OpenFileNode);
				return undefined;

			case 'CloseFile':
				await this.fileOperations.closeFile(node as CloseFileNode);
				return undefined;

			case 'ReadFile':
				await this.fileOperations.readFile(node as ReadFileNode);
				return undefined;

			case 'WriteFile':
				await this.fileOperations.writeFile(node as WriteFileNode);
				return undefined;

			case 'Seek':
				await this.fileOperations.seek(node as SeekNode);
				return undefined;

			case 'GetRecord':
				await this.fileOperations.getRecord(node as GetRecordNode);
				return undefined;

			case 'PutRecord':
				await this.fileOperations.putRecord(node as PutRecordNode);
				return undefined;

			case 'TypeDeclaration':
				this.evaluateTypeDeclaration(node as TypeDeclarationNode);
				return undefined;

			case 'SetDeclaration':
				await this.evaluateSetDeclaration(node as SetDeclarationNode);
				return undefined;

			case 'ClassDeclaration':
				this.evaluateClassDeclaration(node as ClassDeclarationNode);
				return undefined;

			case 'BinaryExpression':
				return this.evaluateBinaryExpression(node as BinaryExpressionNode);

			case 'UnaryExpression':
				return this.evaluateUnaryExpression(node as UnaryExpressionNode);

			case 'Identifier':
				return this.evaluateIdentifier(node as IdentifierNode);

			case 'Literal':
				return this.evaluateLiteral(node as LiteralNode);

			case 'ArrayAccess':
				return this.evaluateArrayAccess(node as ArrayAccessNode);

			case 'CallExpression':
				return this.evaluateCallExpression(node as CallExpressionNode);

			case 'MemberAccess':
				return this.evaluateMemberAccess(node as MemberAccessNode);

			case 'NewExpression':
				return this.evaluateNewExpression(node as NewExpressionNode);

			case 'TypeCast':
				return this.evaluateTypeCast(node as TypeCastNode);

			default:
				throw new RuntimeError(`Unknown node type: ${node.type}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a DECLARE statement
	 */
	private async evaluateDeclareStatement(node: DeclareStatementNode): Promise<void> {
		const resolvedType = this.resolveType(node.dataType, node.line, node.column);
		let initialValue: unknown;

		if (node.initialValue) {
			initialValue = await this.evaluate(node.initialValue);
		} else {
			// Set default value based on type
			if (typeof resolvedType === 'string') {
				switch (resolvedType) {
					case PseudocodeType.INTEGER:
					case PseudocodeType.REAL:
						initialValue = 0;
						break;
					case PseudocodeType.CHAR:
						initialValue = ' ';
						break;
					case PseudocodeType.STRING:
						initialValue = '';
						break;
					case PseudocodeType.BOOLEAN:
						initialValue = false;
						break;
					case PseudocodeType.DATE:
						initialValue = new Date();
						break;
				}
			} else if ('elementType' in resolvedType && !('kind' in resolvedType)) {
				// Array type - initialize with empty array
				initialValue = this.createEmptyArray(resolvedType);
			} else if ('kind' in resolvedType && resolvedType.kind === 'ENUM') {
				initialValue = resolvedType.values[0] ?? '';
			} else if ('kind' in resolvedType && resolvedType.kind === 'SET') {
				initialValue = new Set();
			} else if ('fields' in resolvedType) {
				// User-defined type - initialize with empty object
				initialValue = {};
				const userDefinedType = resolvedType;
				for (const fieldName of Object.keys(userDefinedType.fields)) {
					(initialValue as Record<string, unknown>)[fieldName] = this.getDefaultValueForFieldType(userDefinedType.fields[fieldName]);
				}
			}
		}

		this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
	}

	/**
	 * Evaluate a variable declaration
	 */
	private async evaluateVariableDeclaration(node: VariableDeclarationNode): Promise<void> {
		const resolvedType = this.resolveType(node.dataType, node.line, node.column);
		let initialValue: unknown;

		if (node.initialValue) {
			initialValue = await this.evaluate(node.initialValue);
		} else {
			// Set default value based on type
			if (typeof resolvedType === 'string') {
				switch (resolvedType) {
					case PseudocodeType.INTEGER:
					case PseudocodeType.REAL:
						initialValue = 0;
						break;
					case PseudocodeType.CHAR:
						initialValue = ' ';
						break;
					case PseudocodeType.STRING:
						initialValue = '';
						break;
					case PseudocodeType.BOOLEAN:
						initialValue = false;
						break;
					case PseudocodeType.DATE:
						initialValue = new Date();
						break;
				}
			} else if ('elementType' in resolvedType && !('kind' in resolvedType)) {
				// Array type - initialize with empty array
				initialValue = this.createEmptyArray(resolvedType);
			} else if ('kind' in resolvedType && resolvedType.kind === 'ENUM') {
				initialValue = resolvedType.values[0] ?? '';
			} else if ('kind' in resolvedType && resolvedType.kind === 'SET') {
				initialValue = new Set();
			} else if ('fields' in resolvedType) {
				// User-defined type - initialize with empty object
				initialValue = {};
				const userDefinedType = resolvedType;
				for (const fieldName of Object.keys(userDefinedType.fields)) {
					(initialValue as Record<string, unknown>)[fieldName] = this.getDefaultValueForFieldType(userDefinedType.fields[fieldName]);
				}
			}
		}

		this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
	}

	/**
	 * Evaluate an assignment statement
	 */
	private async evaluateAssignment(node: AssignmentNode): Promise<void> {
		let value: unknown;

		if (node.target.type === 'Identifier') {
			const identifier = node.target as IdentifierNode;
			const targetType = this.environment.getType(identifier.name);
			if (
				typeof targetType === 'object' &&
				targetType !== null &&
				'kind' in targetType &&
				targetType.kind === 'ENUM' &&
				node.value.type === 'Identifier'
			) {
				value = (node.value as IdentifierNode).name;
			} else {
				value = await this.evaluate(node.value);
			}
		} else {
			value = await this.evaluate(node.value);
		}

		if (node.target.type === 'Identifier') {
			const identifier = node.target as IdentifierNode;
			this.environment.assign(identifier.name, value);
		} else if (node.target.type === 'ArrayAccess') {
			const arrayAccess = node.target as ArrayAccessNode;
			const array = await this.evaluate(arrayAccess.array);
			const indices = await Promise.all(arrayAccess.indices.map(async (index) => this.evaluate(index)));

			if (arrayAccess.array.type === 'Identifier') {
				const typeInfo = this.environment.getType((arrayAccess.array as IdentifierNode).name);
				if (typeof typeInfo === 'object' && typeInfo !== null && 'elementType' in typeInfo) {
					VariableAtomFactory.createAtom(typeInfo.elementType, value);
				}
			}

			// Set the array element at the specified indices
			this.setArrayElement(array, indices as number[], value);
		} else if (node.target.type === 'MemberAccess') {
			const memberAccess = node.target as MemberAccessNode;
			const declaredParentType = this.resolveMemberPathType(memberAccess.object);
			if (declaredParentType) {
				const fieldType = declaredParentType.fields[memberAccess.field];
				if (fieldType === undefined) {
					throw new RuntimeError(`Unknown field '${memberAccess.field}' on type '${declaredParentType.name}'`, node.line, node.column);
				}
				VariableAtomFactory.createAtom(fieldType, value);
			}
			const object = await this.evaluate(memberAccess.object);

			// Handle UserDefinedAtom
			if (object instanceof VariableAtom && typeof object.type === 'object' && object.type !== null && 'fields' in object.type) {
				const userDefinedAtom = object as UserDefinedAtom;
				const objectValue = userDefinedAtom.value as Record<string, unknown>;
				const fieldType = userDefinedAtom.type.fields[memberAccess.field];
				if (fieldType === undefined) {
					throw new RuntimeError(`Unknown field '${memberAccess.field}' on type '${userDefinedAtom.type.name}'`, node.line, node.column);
				}
				VariableAtomFactory.createAtom(fieldType, value);
				objectValue[memberAccess.field] = value;
			} else if (object === null || typeof object !== 'object') {
				throw new RuntimeError('Cannot access property of non-object', node.line, node.column);
			} else {
				if (declaredParentType && !(memberAccess.field in (object as Record<string, unknown>))) {
					throw new RuntimeError(`Unknown field '${memberAccess.field}' on type '${declaredParentType.name}'`, node.line, node.column);
				}
				(object as Record<string, unknown>)[memberAccess.field] = value;
			}
		} else {
			throw new RuntimeError('Invalid assignment target', node.line, node.column);
		}
	}

	/**
	 * Evaluate an IF statement
	 */
	private async evaluateIf(node: IfNode): Promise<void> {
		const condition = await this.evaluate(node.condition);

		if (this.isTruthy(condition)) {
			for (const statement of node.thenBranch) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}
		} else if (node.elseBranch) {
			for (const statement of node.elseBranch) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}
		}
	}

	/**
	 * Evaluate a CASE statement
	 */
	private async evaluateCase(node: CaseNode): Promise<void> {
		const expressionValue = await this.evaluate(node.expression) as number | string;
		let executed = false;

		for (const caseItem of node.cases) {
			if (caseItem.values.length === 2) {
				const value1 = await this.evaluate(caseItem.values[0]) as number | string;
				const value2 = await this.evaluate(caseItem.values[1]) as number | string;

				if (value1 <= expressionValue && expressionValue <= value2) {
					executed = true;

					for (const statement of caseItem.body) {
						await this.evaluate(statement);

						if (this.context.shouldReturnFromRoutine()) {
							return;
						}
					}

					break;
				}
			}
			else if (caseItem.values.length === 1) {
				const value = await this.evaluate(caseItem.values[0]);

				if (this.isEqual(expressionValue, value)) {
					executed = true;

					for (const statement of caseItem.body) {
						await this.evaluate(statement);

						if (this.context.shouldReturnFromRoutine()) {
							return;
						}
					}

					break;
				}
			}
			else {
				throw new RuntimeError('Invalid case item', node.line, node.column);
			}

			if (executed) {
				break;
			}
		}

		// Execute OTHERWISE case if no other case matched
		if (!executed && node.otherwise) {
			for (const statement of node.otherwise) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}
		}
	}

	/**
	 * Evaluate a FOR loop
	 */
	private async evaluateFor(node: ForNode): Promise<void> {
		const start = await this.evaluate(node.start) as number;
		const end = await this.evaluate(node.end) as number;
		const step = node.step ? await this.evaluate(node.step) as number : 1;

		// Initialize the loop variable
		if (!this.environment.has(node.variable)) this.environment.define(node.variable, PseudocodeType.INTEGER, start);

		// Determine the direction of the loop
		const increment = step > 0;

		for (
			let currentValue = start;
			increment ? currentValue <= end : currentValue >= end;
			currentValue += step
		) {
			// Update the loop variable
			this.environment.assign(node.variable, currentValue);

			// Execute the loop body
			for (const statement of node.body) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}

			// Get the current value of the loop variable (it might have been changed in the loop)
			currentValue = this.environment.get(node.variable) as number;
		}
	}

	/**
	 * Evaluate a WHILE loop
	 */
	private async evaluateWhile(node: WhileNode): Promise<void> {
		while (true) {
			const condition = await this.evaluate(node.condition);

			if (!this.isTruthy(condition)) {
				break;
			}

			for (const statement of node.body) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}
		}
	}

	/**
	 * Evaluate a REPEAT loop
	 */
	private async evaluateRepeat(node: RepeatNode): Promise<void> {
		do {
			for (const statement of node.body) {
				await this.evaluate(statement);

				if (this.context.shouldReturnFromRoutine()) {
					return;
				}
			}
		} while (!this.isTruthy(await this.evaluate(node.condition)));
	}

	/**
	 * Evaluate a procedure declaration
	 */
	private evaluateProcedureDeclaration(node: ProcedureDeclarationNode): void {
		const signature = {
			name: node.name,
			parameters: node.parameters.map(param => ({
				name: param.name,
				type: this.resolveType(param.dataType, param.line, param.column),
				mode: param.mode
			}))
		};

		const routineInfo: RoutineInfo = {
			...signature,
			node
		};

		this.environment.defineRoutine(signature);
		this.globalRoutines.set(node.name, routineInfo);
	}

	/**
	 * Evaluate a function declaration
	 */
	private evaluateFunctionDeclaration(node: FunctionDeclarationNode): void {
		const signature = {
			name: node.name,
			parameters: node.parameters.map(param => ({
				name: param.name,
				type: this.resolveType(param.dataType, param.line, param.column),
				mode: param.mode
			})),
			returnType: this.resolveType(node.returnType, node.line, node.column)
		};

		const routineInfo: RoutineInfo = {
			...signature,
			node
		};

		this.environment.defineRoutine(signature);
		this.globalRoutines.set(node.name, routineInfo);
	}

	/**
	 * Evaluate a CALL statement
	 */
	private async evaluateCallStatement(node: CallStatementNode): Promise<void> {
		await this.evaluateCallExpression({
			type: 'CallExpression',
			name: node.name,
			arguments: node.arguments,
			line: node.line,
			column: node.column
		} as CallExpressionNode);
	}

	/**
	 * Evaluate an INPUT statement
	 */
	private async evaluateInput(node: InputNode): Promise<void> {
		let promptText = '';

		if (node.prompt) {
			const promptValue = await this.evaluate(node.prompt);
			promptText = String(promptValue);
		}

		const input = await this.io.input(promptText);
		// Get the target variable name safely
		let targetName = '';
		if (node.target.type === 'Identifier') {
			targetName = node.target.name;
		} else {
			throw new RuntimeError('Invalid input target', node.line, node.column);
		}

		const targetType = this.environment.getType(targetName);
		const value = this.convertInput(input, targetType as PseudocodeType);

		if (node.target.type === 'Identifier') {
			this.environment.assign(targetName, value);
		}
	}

	/**
	 * Evaluate an OUTPUT statement
	 */
	private async evaluateOutput(node: OutputNode): Promise<void> {
		const outputValues: string[] = [];

		for (const expression of node.expressions) {
			const value = await this.evaluate(expression);

			// Handle VariableAtom values
			if (value instanceof VariableAtom) {
				outputValues.push(String(value.value));
			} else {
				outputValues.push(String(value));
			}
		}

		this.io.output(outputValues.join('') + '\n');
	}

	/**
	 * Evaluate a RETURN statement
	 */
	private async evaluateReturn(node: ReturnNode): Promise<void> {
		let value: unknown;

		if (node.value) {
			value = await this.evaluate(node.value);
		}

		this.context.setReturnValue(value);
		this.context.shouldReturn = true;
	}

	private async assignValueToTarget(target: ExpressionNode, value: unknown, line?: number, column?: number): Promise<void> {
		if (target.type === 'Identifier') {
			const identifier = target as IdentifierNode;
			this.environment.assign(identifier.name, value);
			return;
		}

		if (target.type === 'ArrayAccess') {
			const arrayAccess = target as ArrayAccessNode;
			const array = await this.evaluate(arrayAccess.array);
			const indices = await Promise.all(arrayAccess.indices.map(async (index) => this.evaluate(index)));
			this.setArrayElement(array, indices as number[], value);
			return;
		}

		throw new RuntimeError('Invalid assignment target', line, column);
	}

	/**
	 * Evaluate a TYPE declaration
	 */
	private evaluateTypeDeclaration(node: TypeDeclarationNode): void {
		if (node.setElementType) {
			const setType: SetTypeInfo = {
				kind: 'SET',
				name: node.name,
				elementType: node.setElementType
			};
			this.setTypes.set(node.name.toUpperCase(), setType);
			return;
		}

		if (node.enumValues && node.enumValues.length > 0) {
			const enumType: EnumTypeInfo = {
				kind: 'ENUM',
				name: node.name,
				values: node.enumValues
			};
			this.enumTypes.set(node.name.toUpperCase(), enumType);
			return;
		}

		// Create a user-defined type
		const userType: UserDefinedTypeInfo = {
			name: node.name,
			fields: {}
		};

		for (const field of node.fields) {
			userType.fields[field.name] = field.dataType;
		}

		this.userDefinedTypes.set(node.name.toUpperCase(), userType);
	}

	private async evaluateSetDeclaration(node: SetDeclarationNode): Promise<void> {
		const setType = this.setTypes.get(node.setTypeName.toUpperCase());
		if (!setType) {
			throw new RuntimeError(`Unknown set type '${node.setTypeName}'`, node.line, node.column);
		}

		const values = new Set<unknown>();
		for (const expr of node.values) {
			const value = await this.evaluate(expr);
			values.add(value);
		}

		this.environment.define(node.name, setType, values, false);
	}

	/**
	 * Evaluate a CLASS declaration
	 */
	private evaluateClassDeclaration(node: ClassDeclarationNode): void {
		// Create a class definition
		const classDef = {
			name: node.name,
			inherits: node.inherits,
			fields: node.fields,
			methods: node.methods
		};

		// Store the class definition in the environment
		this.environment.define(node.name, PseudocodeType.STRING, JSON.stringify(classDef), true);
	}

	/**
	 * Evaluate a binary expression
	 */
	private async evaluateBinaryExpression(node: BinaryExpressionNode): Promise<unknown> {
		const left = await this.evaluate(node.left);
		const right = await this.evaluate(node.right);

		switch (node.operator) {
			// Arithmetic operators
			case '+':
				if (typeof left === 'string' || typeof right === 'string') {
					return String(left) + String(right);
				}
				return Number(left) + Number(right);

			case '&':
				return String(left) + String(right);

			case '-':
				return Number(left) - Number(right);

			case '*':
				return Number(left) * Number(right);

			case '/':
				if (Number(right) === 0) {
					throw new DivisionByZeroError(node.line, node.column);
				}
				return Number(left) / Number(right);

			case 'DIV':
				if (Number(right) === 0) {
					throw new DivisionByZeroError(node.line, node.column);
				}
				return Math.floor(Number(left) / Number(right));

			case 'MOD':
				if (Number(right) === 0) {
					throw new DivisionByZeroError(node.line, node.column);
				}
				return Number(left) % Number(right);

			// Comparison operators
			case '=':
				return this.isEqual(left, right);

			case '<>':
				return !this.isEqual(left, right);

			case '<':
				return Number(left) < Number(right);

			case '>':
				return Number(left) > Number(right);

			case '<=':
				return Number(left) <= Number(right);

			case '>=':
				return Number(left) >= Number(right);

			// Logical operators
			case 'AND':
				return this.isTruthy(left) && this.isTruthy(right);

			case 'OR':
				return this.isTruthy(left) || this.isTruthy(right);

			case 'IN':
				if (!(right instanceof Set)) {
					throw new RuntimeError('Right operand of IN must be a SET', node.line, node.column);
				}
				return right.has(left);

			default:
				throw new RuntimeError(`Unknown binary operator: ${node.operator}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a unary expression
	 */
	private async evaluateUnaryExpression(node: UnaryExpressionNode): Promise<unknown> {
		const operand = await this.evaluate(node.operand);

		switch (node.operator) {
			case '-':
				return -Number(operand);

			case 'NOT':
				return !this.isTruthy(operand);

			default:
				throw new RuntimeError(`Unknown unary operator: ${node.operator}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate an identifier
	 */
	private evaluateIdentifier(node: IdentifierNode) {
		if (this.environment.has(node.name)) {
			return this.environment.get(node.name);
		}

		for (const enumType of this.enumTypes.values()) {
			if (enumType.values.includes(node.name)) {
				return node.name;
			}
		}

		return this.environment.get(node.name);
	}

	/**
	 * Evaluate a literal
	 */
	private evaluateLiteral(node: LiteralNode) {
		return node.value;
	}

	/**
	 * Evaluate an array access
	 */
	private async evaluateArrayAccess(node: ArrayAccessNode): Promise<unknown> {
		const array = await this.evaluate(node.array);
		const indices = await Promise.all(node.indices.map(async (index) => this.evaluate(index)));

		return this.getArrayElement(array, indices as number[]);
	}

	/**
	 * Evaluate a call expression
	 */
	private async evaluateCallExpression(node: CallExpressionNode): Promise<unknown> {
		const routineName = node.name;

		if (routineName === 'EOF') {
			return this.fileOperations.evaluateEOFCall(node.arguments, node.line, node.column);
		}

		// Check if it's a built-in routine
		if (this.globalRoutines.has(routineName)) {
			const routineInfo = this.globalRoutines.get(routineName)!;

			if (routineInfo.isBuiltIn && routineInfo.implementation) {
				const args = await Promise.all(node.arguments.map(async (arg) => this.evaluate(arg)));
				return routineInfo.implementation(args, this.context);
			}
		}

		// Get the routine signature
		const signature = this.environment.getRoutine(routineName);

		// Evaluate arguments
		const args = await Promise.all(node.arguments.map(async (arg) => this.evaluate(arg)));

		// Create a new environment for the routine
		const routineEnvironment = this.environment.createChild();

		// Set up parameters
		const byRefBindings: Array<{ parameterName: string; callerVariable: string }> = [];
		for (let i = 0; i < signature.parameters.length; i++) {
			const param = signature.parameters[i];
			const arg = args[i];

			if (param.mode === ParameterMode.BY_REFERENCE) {
				const argNode = node.arguments[i];
				if (!argNode || argNode.type !== 'Identifier') {
					throw new RuntimeError(`BYREF parameter '${param.name}' requires a variable identifier argument`, node.line, node.column);
				}

				byRefBindings.push({
					parameterName: param.name,
					callerVariable: (argNode as IdentifierNode).name
				});
			}

			// Initialize parameter binding in routine scope
			routineEnvironment.define(param.name, param.type, arg);
		}

		// Create a new execution context for the routine
		const routineContext = new ExecutionContext(routineEnvironment);

		// Push call frame
		const returnAddress = this.context.currentLine !== undefined && this.context.currentColumn !== undefined
			? { line: this.context.currentLine, column: this.context.currentColumn }
			: undefined;

		this.context.pushCallFrame({
			routineName,
			environment: this.environment,
			returnAddress
		});

		// Swap contexts and environments
		const previousContext = this.context;
		const previousEnvironment = this.environment;
		this.context = routineContext;
		this.environment = routineEnvironment;

		// Execute the routine
		let result: unknown;

		if (this.globalRoutines.has(routineName)) {
			const routineInfo = this.globalRoutines.get(routineName)!;

			if (routineInfo.node) {
				// Execute user-defined routine
				if (routineInfo.node.type === 'ProcedureDeclaration') {
					const procedureNode = routineInfo.node as ProcedureDeclarationNode;

					for (const statement of procedureNode.body) {
						await this.evaluate(statement);

						if (this.context.shouldReturnFromRoutine()) {
							break;
						}
					}
				} else if (routineInfo.node.type === 'FunctionDeclaration') {
					const functionNode = routineInfo.node as FunctionDeclarationNode;

					for (const statement of functionNode.body) {
						await this.evaluate(statement);

						if (this.context.shouldReturnFromRoutine()) {
							break;
						}
					}

					result = this.context.getReturnValue();
				}
			}
		}

		// Restore context and environment
		this.context = previousContext;
		this.environment = previousEnvironment;

		// Propagate BYREF updates back to caller scope
		for (const binding of byRefBindings) {
			const updatedValue = routineEnvironment.get(binding.parameterName);
			this.environment.assign(binding.callerVariable, updatedValue);
		}

		// Pop call frame
		this.context.popCallFrame();

		return result;
	}

	/**
	 * Evaluate a member access
	 */
	private async evaluateMemberAccess(node: MemberAccessNode): Promise<unknown> {
		const object = await this.evaluate(node.object);

		// Handle UserDefinedAtom
		if (object instanceof VariableAtom && typeof object.type === 'object' && object.type !== null && 'fields' in object.type) {
			const userDefinedAtom = object as UserDefinedAtom;
			const objectValue = userDefinedAtom.value as Record<string, unknown>;
			return objectValue[node.field];
		}

		// Handle regular object
		if (object === null || typeof object !== 'object') {
			throw new RuntimeError('Cannot access property of non-object', node.line, node.column);
		}

		const parentType = this.resolveMemberPathType(node.object);
		if (parentType && !(node.field in parentType.fields)) {
			throw new RuntimeError(`Unknown field '${node.field}' on type '${parentType.name}'`, node.line, node.column);
		}

		return (object as Record<string, unknown>)[node.field];
	}

	private resolveMemberPathType(expression: ExpressionNode): UserDefinedTypeInfo | undefined {
		if (expression.type === 'Identifier') {
			const typeInfo = this.environment.getType((expression as IdentifierNode).name);
			if (typeof typeInfo === 'object' && typeInfo !== null && 'fields' in typeInfo) {
				return typeInfo;
			}
			return undefined;
		}

		if (expression.type === 'MemberAccess') {
			const member = expression as MemberAccessNode;
			const parentType = this.resolveMemberPathType(member.object);
			if (!parentType) {
				return undefined;
			}
			const fieldType = parentType.fields[member.field];
			if (!fieldType) {
				return undefined;
			}
			if (typeof fieldType === 'object' && fieldType !== null && 'fields' in fieldType) {
				return fieldType;
			}
			return undefined;
		}

		return undefined;
	}

	/**
	 * Evaluate a NEW expression
	 */
	private evaluateNewExpression(_node: NewExpressionNode): unknown {
		// Create a new instance of the class
		const instance = {};

		// In a real implementation, we would:
		// 1. Look up the class definition
		// 2. Create a new instance with the class's fields
		// 3. Call the constructor with the provided arguments

		return instance;
	}

	/**
	 * Evaluate a type cast
	 */
	private async evaluateTypeCast(node: TypeCastNode): Promise<unknown> {
		const value = await this.evaluate(node.expression);

		// Type conversion is now handled by the VariableAtom itself
		return value;
	}

	/**
	 * Check if a value is truthy
	 */
	private isTruthy(value: unknown): boolean {
		if (value === null || value === undefined) {
			return false;
		}

		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'number') {
			return value !== 0;
		}

		if (typeof value === 'string') {
			return value.length > 0;
		}

		return true;
	}

	/**
	 * Check if two values are equal
	 */
	private isEqual(a: unknown, b: unknown): boolean {
		if (a === b) {
			return true;
		}

		// Handle number comparison with tolerance
		if (typeof a === 'number' && typeof b === 'number') {
			return Math.abs(a - b) < 1e-10;
		}

		// Handle array comparison
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) {
				return false;
			}

			for (let i = 0; i < a.length; i++) {
				if (!this.isEqual(a[i], b[i])) {
					return false;
				}
			}

			return true;
		}

		// Handle object comparison
		if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
			const aKeys = Object.keys(a);
			const bKeys = Object.keys(b);

			if (aKeys.length !== bKeys.length) {
				return false;
			}

			for (const key of aKeys) {
				if (!bKeys.includes(key) || !this.isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
					return false;
				}
			}

			return true;
		}

		return false;
	}

	/**
	 * Convert input to the appropriate type
	 * Note: Type conversion is now primarily handled by VariableAtom instances,
	 * but this method is kept for input operations where we don't yet have an atom.
	 */
	private convertInput(input: string, targetType: PseudocodeType): unknown {
		switch (targetType) {
			case PseudocodeType.INTEGER:
				return parseInt(input, 10);
			case PseudocodeType.REAL:
				return parseFloat(input);
			case PseudocodeType.CHAR:
				return input.charAt(0);
			case PseudocodeType.STRING:
				return input;
			case PseudocodeType.BOOLEAN:
				return input.toLowerCase() === 'true';
			case PseudocodeType.DATE:
				return new Date(input);
		}
	}

	/**
	 * Create an empty array with the specified bounds
	 */
	private createEmptyArray(arrayType: ArrayTypeInfo): unknown[] {
		if (arrayType.bounds.length === 1) {
			const bound = arrayType.bounds[0];
			const size = bound.upper - bound.lower + 1;
			return Array.from({ length: size }, () => this.getDefaultValueForType(arrayType.elementType));
		}

		// Create multi-dimensional array recursively
		const result: unknown[] = [];
		const bound = arrayType.bounds[0];
		const size = bound.upper - bound.lower + 1;

		const subArrayType: ArrayTypeInfo = {
			elementType: arrayType.elementType,
			bounds: arrayType.bounds.slice(1)
		};

		for (let i = 0; i < size; i++) {
			result.push(this.createEmptyArray(subArrayType));
		}

		return result;
	}

	private getDefaultValueForType(type: PseudocodeType): unknown {
		switch (type) {
			case PseudocodeType.INTEGER:
			case PseudocodeType.REAL:
				return 0;
			case PseudocodeType.CHAR:
				return ' ';
			case PseudocodeType.STRING:
				return '';
			case PseudocodeType.BOOLEAN:
				return false;
			case PseudocodeType.DATE:
				return new Date(0);
		}
	}

	private getDefaultValueForFieldType(type: TypeInfo): unknown {
		if (typeof type === 'string') {
			return this.getDefaultValueForType(type);
		}
		if ('kind' in type && type.kind === 'ENUM') {
			return type.values[0] ?? '';
		}
		if ('kind' in type && type.kind === 'SET') {
			return new Set();
		}
		if ('fields' in type) {
			const result: Record<string, unknown> = {};
			for (const [fieldName, fieldType] of Object.entries(type.fields)) {
				result[fieldName] = this.getDefaultValueForFieldType(fieldType);
			}
			return result;
		}
		return this.createEmptyArray(type);
	}

	private resolveType(
		type: TypeInfo,
		line?: number,
		column?: number,
		resolving: Set<string> = new Set()
	): TypeInfo {
		if (typeof type === 'string') {
			return type;
		}

		if ('kind' in type) {
			return type;
		}

		if ('elementType' in type) {
			return {
				elementType: type.elementType,
				bounds: type.bounds
			};
		}

		if (Object.keys(type.fields).length > 0) {
			const resolvedFields: Record<string, TypeInfo> = {};
			for (const [fieldName, fieldType] of Object.entries(type.fields)) {
				resolvedFields[fieldName] = this.resolveType(fieldType, line, column, resolving);
			}
			return {
				name: type.name,
				fields: resolvedFields
			};
		}

		const lookupName = type.name.toUpperCase();
		if (resolving.has(lookupName)) {
			throw new RuntimeError(`Recursive type '${type.name}' is not supported`, line, column);
		}

		resolving.add(lookupName);
		const resolved = this.userDefinedTypes.get(type.name.toUpperCase());
		const resolvedEnum = this.enumTypes.get(type.name.toUpperCase());
		if (resolvedEnum) {
			resolving.delete(lookupName);
			return resolvedEnum;
		}
		const resolvedSet = this.setTypes.get(type.name.toUpperCase());
		if (resolvedSet) {
			resolving.delete(lookupName);
			return resolvedSet;
		}
		if (!resolved) {
			resolving.delete(lookupName);
			throw new RuntimeError(`Unknown type '${type.name}'`, line, column);
		}

		const resolvedFields: Record<string, TypeInfo> = {};
		for (const [fieldName, fieldType] of Object.entries(resolved.fields)) {
			resolvedFields[fieldName] = this.resolveType(fieldType, line, column, resolving);
		}
		resolving.delete(lookupName);

		return {
			name: resolved.name,
			fields: resolvedFields
		};
	}

	/**
	 * Get an element from an array at the specified indices
	 */
	private getArrayElement(array: unknown, indices: number[]): unknown {
		// Handle ArrayAtom
		if (array instanceof VariableAtom && typeof array.type === 'object' && array.type !== null && 'elementType' in array.type) {
			const arrayAtom = array as ArrayAtom;
			const arrayValue = arrayAtom.value as unknown[];
			return this.getArrayElementFromValue(arrayValue, indices);
		}

		// Handle regular array
		if (!Array.isArray(array)) {
			throw new RuntimeError('Array access on non-array value');
		}

		return this.getArrayElementFromValue(array, indices);
	}

	/**
	 * Get an element from an array value at the specified indices
	 */
	private getArrayElementFromValue(array: unknown[], indices: number[]): unknown {
		if (indices.length === 1) {
			const index = indices[0];
			if (!Number.isInteger(index)) {
				throw new IndexError('Array index must be INTEGER');
			}
			if (index < 1 || index > array.length) {
				throw new IndexError(`Array index out of bounds: ${index}`);
			}

			// Convert from 1-based to 0-based indexing
			return array[index - 1];
		}

		const subArray = array[indices[0] - 1] as unknown[]; // Convert from 1-based to 0-based indexing
		return this.getArrayElementFromValue(subArray, indices.slice(1));
	}

	/**
	 * Set an element in an array at the specified indices
	 */
	private setArrayElement(array: unknown, indices: number[], value: unknown): void {
		// Handle ArrayAtom
		if (array instanceof VariableAtom && typeof array.type === 'object' && array.type !== null && 'elementType' in array.type) {
			const arrayAtom = array as ArrayAtom;
			const cloned = JSON.parse(JSON.stringify(arrayAtom.value)) as unknown[];
			this.setArrayElementInValue(cloned, indices, value);
			arrayAtom.value = cloned;
			return;
		}

		// Handle regular array
		if (!Array.isArray(array)) {
			throw new RuntimeError('Array access on non-array value');
		}

		this.setArrayElementInValue(array, indices, value);
	}

	/**
	 * Set an element in an array value at the specified indices
	 */
	private setArrayElementInValue(array: unknown[], indices: number[], value: unknown): void {
		if (indices.length === 1) {
			const index = indices[0];
			if (!Number.isInteger(index)) {
				throw new IndexError('Array index must be INTEGER');
			}
			if (index < 1 || index > array.length) {
				throw new IndexError(`Array index out of bounds: ${index}`);
			}

			// Convert from 1-based to 0-based indexing
			array[index - 1] = value;
			return;
		}

		const subArray = array[indices[0] - 1] as unknown[]; // Convert from 1-based to 0-based indexing
		this.setArrayElementInValue(subArray, indices.slice(1), value);
	}

	/**
	 * Initialize built-in routines
	 */
	private initializeBuiltInRoutines(): void {
		Object.keys(builtInFunctions).forEach((name) => {
			this.globalRoutines.set(name, { ...builtInFunctions[name], name });
		});
	}
}
