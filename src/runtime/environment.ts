/**
 * Runtime Environment for CAIE Pseudocode Interpreter
 *
 * This module implements the environment for variable scoping and storage
 * during pseudocode execution.
 */

import {
	PseudocodeType,
	ArrayTypeInfo,
	UserDefinedTypeInfo,
	VariableInfo,
	// ParameterMode,
	// ParameterInfo,
	RoutineSignature
} from '../types';
import { RuntimeError } from '../errors';
import { ASTNode } from '../parser/ast-nodes';
import { VariableAtom, VariableAtomFactory } from './variable-atoms';
// import { IOInterface } from '../io/io-interface';

/**
 * Runtime value wrapper
 */
export interface RuntimeValue {
	value: unknown;
	type: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
}

/**
 * Execution context for tracking runtime state
 */
export class ExecutionContext {
	environment: Environment;
	returnValue?: unknown;
	shouldReturn: boolean;
	currentLine?: number;
	currentColumn?: number;
	callStack: CallFrame[];

	constructor(environment: Environment) {
		this.environment = environment;
		this.shouldReturn = false;
		this.callStack = [];
	}

	/**
	 * Check if we should return from the current routine
	 */
	shouldReturnFromRoutine(): boolean {
		return this.shouldReturn;
	}

	/**
	 * Get the return value
	 */
	getReturnValue(): unknown {
		return this.returnValue;
	}

	/**
	 * Set the return value
	 */
	setReturnValue(value: unknown): void {
		this.returnValue = value;
	}

	/**
	 * Reset the return flag
	 */
	resetReturnFlag(): void {
		this.shouldReturn = false;
		this.returnValue = undefined;
	}

	/**
	 * Push a call frame onto the call stack
	 */
	pushCallFrame(frame: CallFrame): void {
		this.callStack.push(frame);
	}

	/**
	 * Pop a call frame from the call stack
	 */
	popCallFrame(): CallFrame | undefined {
		return this.callStack.pop();
	}

	/**
	 * Get the current call frame
	 */
	getCurrentCallFrame(): CallFrame | undefined {
		return this.callStack[this.callStack.length - 1];
	}
}

/**
 * Call frame for tracking routine calls
 */
export interface CallFrame {
	routineName: string;
	environment: Environment;
	returnAddress?: { line: number; column: number };
}

/**
 * Scope information for debugging
 */
export interface Scope {
	variables: VariableInfo[];
	parent?: Scope;
}

/**
 * Extended routine information with execution details
 */
export interface RoutineInfo extends RoutineSignature {
	node?: ASTNode; // AST node for the routine
	isBuiltIn?: boolean;
	implementation?: (args: unknown[], context: ExecutionContext) => unknown;
	// Override returnType to allow complex types
	returnType?: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
}

/**
 * Environment class for managing variable scopes and storage
 */
export class Environment {
	private variables: Map<string, VariableAtom> = new Map();
	private parent?: Environment;
	private routines: Map<string, RoutineSignature> = new Map();
	private fileHandles: Map<string, number> = new Map();
	private nextFileHandle: number = 1;

	constructor(parent?: Environment) {
		this.parent = parent;
	}

	/**
	 * Define a variable in the current environment
	 */
	define(name: string, type: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo, value: unknown, isConstant: boolean = false): void {
		if (this.variables.has(name)) {
			throw new RuntimeError(`Variable '${name}' already declared in this scope`);
		}

		const atom = VariableAtomFactory.createAtom(type, value, isConstant);
		this.variables.set(name, atom);
	}

	/**
	 * Get the value of a variable
	 */
	get(name: string): unknown {
		if (this.variables.has(name)) {
			const atom = this.variables.get(name)!;
			return atom.value;
		}

		if (this.parent !== undefined) {
			return this.parent.get(name);
		}

		throw new RuntimeError(`Undefined variable '${name}'`);
	}

	/**
	 * Get the type of a variable
	 */
	getType(name: string): PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo {
		if (this.variables.has(name)) {
			const atom = this.variables.get(name)!;
			return atom.type;
		}

		if (this.parent !== undefined) {
			return this.parent.getType(name);
		}

		throw new RuntimeError(`Undefined variable '${name}'`);
	}

	/**
	 * Check if a variable is defined
	 */
	has(name: string): boolean {
		if (this.variables.has(name)) {
			return true;
		}

		if (this.parent !== undefined) {
			return this.parent.has(name);
		}

		return false;
	}

	/**
	 * Assign a value to a variable
	 */
	assign(name: string, value: unknown): void {
		if (this.variables.has(name)) {
			const atom = this.variables.get(name)!;

			if (atom.isConstant) {
				throw new RuntimeError(`Cannot assign to constant '${name}'`);
			}

			// Use the atom's built-in validation and assignment
			atom.value = value;
			return;
		}

		if (this.parent !== undefined) {
			this.parent.assign(name, value);
			return;
		}

		throw new RuntimeError(`Undefined variable '${name}'`);
	}

	/**
	 * Define a routine (procedure or function)
	 */
	defineRoutine(signature: RoutineSignature): void {
		if (this.routines.has(signature.name)) {
			throw new RuntimeError(`Routine '${signature.name}' already declared`);
		}

		this.routines.set(signature.name, signature);
	}

	/**
	 * Get a routine signature
	 */
	getRoutine(name: string): RoutineSignature {
		if (this.routines.has(name)) {
			return this.routines.get(name)!;
		}

		if (this.parent !== undefined) {
			return this.parent.getRoutine(name);
		}

		throw new RuntimeError(`Undefined routine '${name}'`);
	}

	/**
	 * Check if a routine is defined
	 */
	hasRoutine(name: string): boolean {
		if (this.routines.has(name)) {
			return true;
		}

		if (this.parent !== undefined) {
			return this.parent.hasRoutine(name);
		}

		return false;
	}

	/**
	 * Allocate a file handle
	 */
	allocateFileHandle(variableName: string): number {
		const handle = this.nextFileHandle++;
		this.fileHandles.set(variableName, handle);
		return handle;
	}

	/**
	 * Get a file handle
	 */
	getFileHandle(variableName: string): number {
		if (this.fileHandles.has(variableName)) {
			return this.fileHandles.get(variableName)!;
		}

		if (this.parent !== undefined) {
			return this.parent.getFileHandle(variableName);
		}

		throw new RuntimeError(`Undefined file handle '${variableName}'`);
	}

	/**
	 * Release a file handle
	 */
	releaseFileHandle(variableName: string): void {
		if (this.fileHandles.has(variableName)) {
			this.fileHandles.delete(variableName);
			return;
		}

		if (this.parent !== undefined) {
			this.parent.releaseFileHandle(variableName);
			return;
		}

		throw new RuntimeError(`Undefined file handle '${variableName}'`);
	}

	/**
	 * Create a new environment with the current one as parent
	 */
	createChild(): Environment {
		return new Environment(this);
	}

	/**
	 * Validate that a value matches the expected type
	 */
	private validateType(value: unknown, expectedType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo): void {
		if (typeof expectedType === 'string') {
			// Simple type
			this.validateSimpleType(value, expectedType);
		} else if ('elementType' in expectedType) {
			// Array type
			this.validateArrayType(value, expectedType);
		} else if ('fields' in expectedType) {
			// User-defined type
			this.validateUserDefinedType(value, expectedType);
		}
	}

	/**
	 * Validate a simple type
	 */
	private validateSimpleType(value: unknown, expectedType: PseudocodeType): void {
		switch (expectedType) {
			case PseudocodeType.INTEGER:
				if (typeof value !== 'number' || !Number.isInteger(value)) {
					throw new RuntimeError(`Expected INTEGER, got ${typeof value}`);
				}
				break;
			case PseudocodeType.REAL:
				if (typeof value !== 'number') {
					throw new RuntimeError(`Expected REAL, got ${typeof value}`);
				}
				break;
			case PseudocodeType.CHAR:
				if (typeof value !== 'string' || (typeof value === 'string' && value.length !== 1)) {
					throw new RuntimeError(`Expected CHAR, got ${typeof value}`);
				}
				break;
			case PseudocodeType.STRING:
				if (typeof value !== 'string') {
					throw new RuntimeError(`Expected STRING, got ${typeof value}`);
				}
				break;
			case PseudocodeType.BOOLEAN:
				if (typeof value !== 'boolean') {
					throw new RuntimeError(`Expected BOOLEAN, got ${typeof value}`);
				}
				break;
			case PseudocodeType.DATE:
				if (!(value instanceof Date)) {
					throw new RuntimeError(`Expected DATE, got ${typeof value}`);
				}
				break;
		}
	}

	/**
	 * Validate an array type
	 */
	private validateArrayType(value: unknown, expectedType: ArrayTypeInfo): void {
		if (!Array.isArray(value)) {
			throw new RuntimeError(`Expected ARRAY, got ${typeof value}`);
		}

		// Check dimensions
		const expectedDimensions = expectedType.bounds.length;
		const actualDimensions = this.getArrayDimensions(value);

		if (expectedDimensions !== actualDimensions) {
			throw new RuntimeError(`Expected ${expectedDimensions}-dimensional array, got ${actualDimensions}-dimensional array`);
		}

		// Check element types recursively
		this.validateArrayElements(value, expectedType.elementType, expectedDimensions);
	}

	/**
	 * Validate a user-defined type
	 */
	private validateUserDefinedType(value: unknown, expectedType: UserDefinedTypeInfo): void {
		if (typeof value !== 'object' || value === null) {
			throw new RuntimeError(`Expected user-defined type '${expectedType.name}', got ${typeof value}`);
		}

		// Check all fields
		for (const [fieldName, fieldType] of Object.entries(expectedType.fields)) {
			if (!(fieldName in value)) {
				throw new RuntimeError(`Missing field '${fieldName}' in user-defined type '${expectedType.name}'`);
			}

			this.validateType(value[fieldName as keyof typeof value], fieldType);
		}
	}

	/**
	 * Get the dimensions of an array
	 */
	private getArrayDimensions(array: unknown[]): number {
		if (array.length === 0) {
			return 1;
		}

		if (Array.isArray(array[0])) {
			return 1 + this.getArrayDimensions(array[0]);
		}

		return 1;
	}

	/**
	 * Validate array elements recursively
	 */
	private validateArrayElements(array: unknown[], elementType: PseudocodeType, dimensions: number): void {
		if (dimensions === 1) {
			for (const element of array) {
				this.validateSimpleType(element, elementType);
			}
		} else {
			for (const subArray of array) {
				if (!Array.isArray(subArray)) {
					throw new RuntimeError(`Expected ${dimensions}-dimensional array, got fewer dimensions`);
				}
				this.validateArrayElements(subArray, elementType, dimensions - 1);
			}
		}
	}

	/**
	 * Get all variables in the current environment (for debugging)
	 */
	getVariables(): VariableInfo[] {
		const variables: VariableInfo[] = [];

		for (const [name, atom] of this.variables.entries()) {
			variables.push({
				name,
				type: atom.type,
				value: atom.value,
				isConstant: atom.isConstant
			});
		}

		return variables;
	}

	/**
	 * Get all routines in the current environment (for debugging)
	 */
	getRoutines(): RoutineSignature[] {
		return Array.from(this.routines.values());
	}

	/**
	 * Define a variable (alias for define)
	 */
	defineVariable(name: string, type: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo, value: unknown, isConstant: boolean = false): void {
		this.define(name, type, value, isConstant);
	}

	/**
	 * Set a variable value (alias for assign)
	 */
	setVariable(name: string, value: unknown): void {
		this.assign(name, value);
	}

	/**
	 * Get a variable value (alias for get)
	 */
	getVariable(name: string): unknown {
		return this.get(name);
	}

	/**
	 * Get a filename from a file handle variable
	 */
	getFilename(handleVariable: string): string {
		// This is a simplified implementation
		// In a real implementation, we would store the filename when opening the file
		return `file_${this.getFileHandle(handleVariable)}`;
	}

	/**
	 * Enter a new scope (alias for createChild)
	 */
	enterScope(): Environment {
		return this.createChild();
	}

	/**
	 * Exit the current scope
	 */
	exitScope(): void {
		// This is a simplified implementation
		// In a real implementation, we would manage scope stack
	}
}
