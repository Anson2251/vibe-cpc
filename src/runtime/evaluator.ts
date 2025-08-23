/**
 * Runtime Evaluator for CAIE Pseudocode Interpreter
 *
 * This module implements the evaluator for executing AST nodes in the CAIE pseudocode language.
 * It interprets the abstract syntax tree and performs the operations specified by the pseudocode.
 */

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
	// SeekNode,
	GetRecordNode,
	PutRecordNode,
	TypeDeclarationNode,
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
	ParameterMode
} from '../types';

import {
	RuntimeError,
	DivisionByZeroError,
	IndexError,
	FileIOError
} from '../errors';

import builtInFunctions from './builtin-functions';

import { Environment, ExecutionContext, RoutineInfo } from './environment';
import { IOInterface } from '../io/io-interface';
import { VariableAtom, ArrayAtom, UserDefinedAtom } from './variable-atoms';

/**
 * Evaluator class for executing AST nodes
 */
export class Evaluator {
	private environment: Environment;
	context: ExecutionContext;
	private io: IOInterface;
	private globalRoutines: Map<string, RoutineInfo> = new Map();

	constructor(io: IOInterface) {
		this.io = io;
		this.environment = new Environment();
		this.context = new ExecutionContext(this.environment);
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
				return await this.evaluateVariableDeclaration(node as VariableDeclarationNode);

			case 'DeclareStatement':
				return await this.evaluateDeclareStatement(node as DeclareStatementNode);

			case 'Assignment':
				return await this.evaluateAssignment(node as AssignmentNode);

			case 'If':
				return await this.evaluateIf(node as IfNode);

			case 'Case':
				return await this.evaluateCase(node as CaseNode);

			case 'For':
				return await this.evaluateFor(node as ForNode);

			case 'While':
				return await this.evaluateWhile(node as WhileNode);

			case 'Repeat':
				return await this.evaluateRepeat(node as RepeatNode);

			case 'ProcedureDeclaration':
				return this.evaluateProcedureDeclaration(node as ProcedureDeclarationNode);

			case 'FunctionDeclaration':
				return this.evaluateFunctionDeclaration(node as FunctionDeclarationNode);

			case 'CallStatement':
				return await this.evaluateCallStatement(node as CallStatementNode);

			case 'Input':
				return await this.evaluateInput(node as InputNode);

			case 'Output':
				return await this.evaluateOutput(node as OutputNode);

			case 'Return':
				return await this.evaluateReturn(node as ReturnNode);

			case 'OpenFile':
				return await this.evaluateOpenFile(node as OpenFileNode);

			case 'CloseFile':
				return await this.evaluateCloseFile(node as CloseFileNode);

			case 'ReadFile':
				return await this.evaluateReadFile(node as ReadFileNode);

			case 'WriteFile':
				return await this.evaluateWriteFile(node as WriteFileNode);

			case 'Seek':
				throw new RuntimeError('Seek statements are not implemented yet.')
			// return await this.evaluateSeek(node as SeekNode);

			case 'GetRecord':
				return await this.evaluateGetRecord(node as GetRecordNode);

			case 'PutRecord':
				return await this.evaluatePutRecord(node as PutRecordNode);

			case 'TypeDeclaration':
				return this.evaluateTypeDeclaration(node as TypeDeclarationNode);

			case 'ClassDeclaration':
				return this.evaluateClassDeclaration(node as ClassDeclarationNode);

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
				return await this.evaluateCallExpression(node as CallExpressionNode);

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
		let initialValue: unknown;

		if (node.initialValue) {
			initialValue = await this.evaluate(node.initialValue);
		} else {
			// Set default value based on type
			if (typeof node.dataType === 'string') {
				switch (node.dataType) {
					case PseudocodeType.INTEGER:
					case PseudocodeType.REAL:
						initialValue = 0;
						break;
					case PseudocodeType.CHAR:
						initialValue = '';
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
			} else if ('elementType' in node.dataType) {
				// Array type - initialize with empty array
				initialValue = this.createEmptyArray(node.dataType);
			} else if ('fields' in node.dataType) {
				// User-defined type - initialize with empty object
				initialValue = {};
				const userDefinedType = node.dataType;
				for (const fieldName of Object.keys(userDefinedType.fields)) {
					(initialValue as Record<string, unknown>)[fieldName] = null;
				}
			}
		}

		this.environment.define(node.name, node.dataType, initialValue, node.isConstant);
	}

	/**
	 * Evaluate a variable declaration
	 */
	private async evaluateVariableDeclaration(node: VariableDeclarationNode): Promise<void> {
		let initialValue: unknown;

		if (node.initialValue) {
			initialValue = await this.evaluate(node.initialValue);
		} else {
			// Set default value based on type
			if (typeof node.dataType === 'string') {
				switch (node.dataType) {
					case PseudocodeType.INTEGER:
					case PseudocodeType.REAL:
						initialValue = 0;
						break;
					case PseudocodeType.CHAR:
						initialValue = '';
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
			} else if ('elementType' in node.dataType) {
				// Array type - initialize with empty array
				initialValue = this.createEmptyArray(node.dataType);
			} else if ('fields' in node.dataType) {
				// User-defined type - initialize with empty object
				initialValue = {};
				const userDefinedType = node.dataType;
				for (const fieldName of Object.keys(userDefinedType.fields)) {
					(initialValue as Record<string, unknown>)[fieldName] = null;
				}
			}
		}

		this.environment.define(node.name, node.dataType, initialValue, node.isConstant);
	}

	/**
	 * Evaluate an assignment statement
	 */
	private async evaluateAssignment(node: AssignmentNode): Promise<void> {
		const value = await this.evaluate(node.value);

		if (node.target.type === 'Identifier') {
			const identifier = node.target as IdentifierNode;
			this.environment.assign(identifier.name, value);
		} else if (node.target.type === 'ArrayAccess') {
			const arrayAccess = node.target as ArrayAccessNode;
			const array = await this.evaluate(arrayAccess.array);
			const indices = await Promise.all(arrayAccess.indices.map(index => this.evaluate(index)));

			// Set the array element at the specified indices
			this.setArrayElement(array, indices as number[], value);
		} else if (node.target.type === 'MemberAccess') {
			const memberAccess = node.target as MemberAccessNode;
			const object = await this.evaluate(memberAccess.object);

			// Handle UserDefinedAtom
			if (object instanceof VariableAtom && typeof object.type === 'object' && object.type !== null && 'fields' in object.type) {
				const userDefinedAtom = object as UserDefinedAtom;
				const objectValue = userDefinedAtom.value as Record<string, unknown>;
				objectValue[memberAccess.field] = value;
			} else if (object === null || typeof object !== 'object') {
				throw new RuntimeError('Cannot access property of non-object', node.line, node.column);
			} else {
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
				type: param.dataType,
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
				type: param.dataType,
				mode: param.mode
			})),
			returnType: node.returnType
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

	/**
	 * Evaluate an OPENFILE statement
	 */
	private async evaluateOpenFile(node: OpenFileNode): Promise<void> {
		const filename = await this.evaluate(node.filename);
		const handleExpression = node.fileHandle;

		if (handleExpression.type !== 'Identifier') {
			throw new RuntimeError('File handle must be an identifier', node.line, node.column);
		}

		const handleVariable = handleExpression as IdentifierNode;

		try {
			switch (node.mode) {
				case 'READ':
					await this.io.openRandomFile(String(filename));
					break;
				case 'WRITE':
					// For write mode, we'll create a new file or truncate existing one
					await this.io.writeFile(String(filename), '');
					await this.io.openRandomFile(String(filename));
					break;
				case 'APPEND':
					// For append mode, we'll open the file and seek to the end
					await this.io.appendFile(String(filename), '');
					await this.io.openRandomFile(String(filename));
					break;
				case 'RANDOM':
					await this.io.openRandomFile(String(filename));
					break;
				default:
					throw new RuntimeError(`Invalid file mode: ${String(node.mode)}`, node.line, node.column);
			}

			// Store the file handle in the environment
			this.environment.allocateFileHandle(handleVariable.name);
		} catch (error) {
			throw new FileIOError(`Failed to open file '${String(filename)}': ${error instanceof Error ? error.message : 'Unknown error'}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a CLOSEFILE statement
	 */
	private async evaluateCloseFile(node: CloseFileNode): Promise<void> {
		const handleExpression = node.fileHandle;

		if (handleExpression.type !== 'Identifier') {
			throw new RuntimeError('File handle must be an identifier', node.line, node.column);
		}

		const handleVariable = handleExpression as IdentifierNode;

		try {
			await this.io.closeFile(this.environment.getFileHandle(handleVariable.name));
			this.environment.releaseFileHandle(handleVariable.name);
		} catch (error) {
			throw new FileIOError(`Failed to close file: ${String(error)}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a READFILE statement
	 */
	private async evaluateReadFile(node: ReadFileNode): Promise<void> {
		const handleVariable = node.fileHandle as IdentifierNode;

		try {
			const content = await this.io.readFile(this.environment.getFilename(handleVariable.name));

			if (node.target.type === 'Identifier') {
				const identifier = node.target as IdentifierNode;
				this.environment.assign(identifier.name, content);
			} else if (node.target.type === 'ArrayAccess') {
				const arrayAccess = node.target as ArrayAccessNode;
				const array = await this.evaluate(arrayAccess.array);
				const indices = await Promise.all(arrayAccess.indices.map(index => this.evaluate(index)));

				// Set the array element at the specified indices
				this.setArrayElement(array, indices as number[], content);
			} else {
				throw new RuntimeError('Invalid read target', node.line, node.column);
			}
		} catch (error) {
			throw new FileIOError(`Failed to read file: ${String(error)}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a WRITEFILE statement
	 */
	private async evaluateWriteFile(node: WriteFileNode): Promise<void> {
		const handleVariable = node.fileHandle as IdentifierNode;

		try {
			const content: string[] = [];

			for (const expression of node.expressions) {
				const value = await this.evaluate(expression);
				content.push(String(value));
			}

			await this.io.writeFile(this.environment.getFilename(handleVariable.name), content.join(''));
		} catch (error) {
			throw new FileIOError(`Failed to write file: ${String(error)}`, node.line, node.column);
		}
	}

	// /**
	//  * Evaluate a SEEK statement
	//  */
	// private async evaluateSeek(node: SeekNode): Promise<void> {
	// 	return;
	// 	const handleVariable = node.fileHandle as IdentifierNode;
	// 	const position = await this.evaluate(node.position);

	// 	try {
	// 		// This is a simplified implementation
	// 		// In a real implementation, we would seek to the specified position
	// 		console.log(`Seeking to position ${String(position)} in file ${handleVariable.name}`);
	// 	} catch (error) {
	// 		throw new FileIOError(`Failed to seek in file: ${String(error)}`, node.line, node.column);
	// 	}
	// }

	/**
	 * Evaluate a GETRECORD statement
	 */
	private async evaluateGetRecord(node: GetRecordNode): Promise<void> {
		const handleVariable = node.fileHandle as IdentifierNode;
		const position = await this.evaluate(node.position);

		try {
			const record = await this.io.readRecord(this.environment.getFileHandle(handleVariable.name), Number(position));

			if (node.target.type === 'Identifier') {
				const identifier = node.target as IdentifierNode;
				this.environment.assign(identifier.name, record);
			} else if (node.target.type === 'ArrayAccess') {
				const arrayAccess = node.target as ArrayAccessNode;
				const array = await this.evaluate(arrayAccess.array);
				const indices = await Promise.all(arrayAccess.indices.map(index => this.evaluate(index)));

				// Set the array element at the specified indices
				this.setArrayElement(array, indices as number[], record);
			} else {
				throw new RuntimeError('Invalid get record target', node.line, node.column);
			}
		} catch (error) {
			throw new FileIOError(`Failed to get record: ${String(error)}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a PUTRECORD statement
	 */
	private async evaluatePutRecord(node: PutRecordNode): Promise<void> {
		const handleVariable = node.fileHandle as IdentifierNode;
		const position = await this.evaluate(node.position);
		const source = await this.evaluate(node.source);

		try {
			const fileHandle = this.environment.getFileHandle(handleVariable.name);
			await this.io.writeRecord(fileHandle, Number(position), String(source));
		} catch (error) {
			throw new FileIOError(`Failed to put record: ${String(error)}`, node.line, node.column);
		}
	}

	/**
	 * Evaluate a TYPE declaration
	 */
	private evaluateTypeDeclaration(node: TypeDeclarationNode): void {
		// Create a user-defined type
		const userType: UserDefinedTypeInfo = {
			name: node.name,
			fields: {}
		};

		for (const field of node.fields) {
			userType.fields[field.name] = field.dataType;
		}

		// Store the type definition in the environment
		this.environment.define(node.name, userType, {}, true);
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
		const indices = await Promise.all(node.indices.map(index => this.evaluate(index)));

		return this.getArrayElement(array, indices as number[]);
	}

	/**
	 * Evaluate a call expression
	 */
	private async evaluateCallExpression(node: CallExpressionNode): Promise<unknown> {
		const routineName = node.name;

		// Check if it's a built-in routine
		if (this.globalRoutines.has(routineName)) {
			const routineInfo = this.globalRoutines.get(routineName)!;

			if (routineInfo.isBuiltIn && routineInfo.implementation) {
				const args = await Promise.all(node.arguments.map(arg => this.evaluate(arg)));
				return routineInfo.implementation(args, this.context);
			}
		}

		// Get the routine signature
		const signature = this.environment.getRoutine(routineName);

		// Evaluate arguments
		const args = await Promise.all(node.arguments.map(arg => this.evaluate(arg)));

		// Create a new environment for the routine
		const routineEnvironment = this.environment.createChild();

		// Set up parameters
		for (let i = 0; i < signature.parameters.length; i++) {
			const param = signature.parameters[i];
			const arg = args[i];

			if (param.mode === ParameterMode.BY_REFERENCE && typeof arg === 'object') {
				// Pass by reference
				routineEnvironment.define(param.name, param.type, arg);
			} else {
				// Pass by value
				routineEnvironment.define(param.name, param.type, arg);
			}
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

		return (object as Record<string, unknown>)[node.field];
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
			return new Array(size);
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
			const arrayValue = arrayAtom.value as unknown[];
			this.setArrayElementInValue(arrayValue, indices, value);
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
