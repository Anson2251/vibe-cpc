/**
 * Variable Atom Classes for CAIE Pseudocode Interpreter
 *
 * This module implements the class hierarchy for variable types, encapsulating
 * both the value and type information in a single object.
 */

import {
	PseudocodeType,
	ArrayTypeInfo,
	UserDefinedTypeInfo
} from '../types';
import { RuntimeError } from '../errors';

/**
 * Comparison result enum
 */
export enum ComparisonResult {
	LESS_THAN = -1,
	EQUAL = 0,
	GREATER_THAN = 1
}

/**
 * Base abstract class for all variable atoms
 */
export abstract class VariableAtom {
	protected _value: unknown;
	protected _isConstant: boolean = false;

	constructor(value: unknown, isConstant: boolean = false) {
		this._value = value;
		this._isConstant = isConstant;
	}

	/**
	 * Get the value of the atom
	 */
	get value(): unknown {
		return this._value;
	}

	/**
	 * Set the value of the atom
	 */
	set value(newValue: unknown) {
		if (this._isConstant) {
			throw new RuntimeError(`Cannot assign to constant`);
		}
		this.validateValue(newValue);
		this._value = newValue;
	}

	/**
	 * Check if the atom is a constant
	 */
	get isConstant(): boolean {
		return this._isConstant;
	}

	/**
	 * Get the pseudocode type of the atom
	 */
	abstract get type(): PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;

	/**
	 * Validate that a value is compatible with this atom's type
	 */
	abstract validateValue(value: unknown): void;

	/**
	 * Convert a value to be compatible with this atom's type
	 */
	abstract convertValue(value: unknown): unknown;

	/**
	 * Create a copy of this atom
	 */
	abstract copy(): VariableAtom;

	/**
	 * Compare this atom with another atom
	 * Returns -1 if this atom is less than the other, 0 if equal, 1 if greater
	 */
	abstract compareTo(other: VariableAtom): ComparisonResult;

	/**
	 * Check if this atom is compatible with another atom
	 */
	isCompatibleWith(other: VariableAtom): boolean {
		if (this.type === other.type) return true;

		// Allow INTEGER to REAL conversion (widening)
		if (this.type === PseudocodeType.REAL && other.type === PseudocodeType.INTEGER) return true;

		return false;
	}

	/**
	 * Get a string representation of the atom
	 */
	toString(): string {
		let typeStr = '';
		if (typeof this.type === 'string') {
			typeStr = this.type;
		} else if ('elementType' in this.type) {
			typeStr = `ARRAY of ${this.type.elementType}`;
		} else if ('name' in this.type) {
			typeStr = this.type.name;
		}

		return `${typeStr}: ${String(this._value)}`;
	}
}

/**
 * Atom for integer values
 */
export class IntegerAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.INTEGER;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'number' || !Number.isInteger(value)) {
			throw new RuntimeError(`Expected INTEGER, got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		try {
			this.validateValue(value);
			return value;
		} catch {
			// Validation failed, try to convert
		}

		if (typeof value === 'number') {
			return Math.floor(value);
		}

		if (typeof value === 'string' && !isNaN(Number(value))) {
			return Math.floor(Number(value));
		}

		throw new RuntimeError(`Cannot convert value '${String(value)}' of type ${typeof value} to INTEGER`);
	}

	copy(): VariableAtom {
		return new IntegerAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof IntegerAtom) {
			const thisVal = this._value as number;
			const otherVal = other.value as number;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		if (other instanceof RealAtom) {
			const thisVal = this._value as number;
			const otherVal = other.value as number;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare INTEGER with unsupported type`);
	}

	// Arithmetic operations
	add(other: IntegerAtom | RealAtom): IntegerAtom | RealAtom {
		if (other instanceof IntegerAtom) {
			return new IntegerAtom((this._value as number) + (other.value as number));
		} else if (other instanceof RealAtom) {
			return new RealAtom((this._value as number) + (other.value as number));
		}
		throw new RuntimeError(`Cannot add INTEGER with unsupported type`);
	}

	subtract(other: IntegerAtom | RealAtom): IntegerAtom | RealAtom {
		if (other instanceof IntegerAtom) {
			return new IntegerAtom((this._value as number) - (other.value as number));
		} else if (other instanceof RealAtom) {
			return new RealAtom((this._value as number) - (other.value as number));
		}
		throw new RuntimeError(`Cannot subtract INTEGER with unsupported type`);
	}

	multiply(other: IntegerAtom | RealAtom): IntegerAtom | RealAtom {
		if (other instanceof IntegerAtom) {
			return new IntegerAtom((this._value as number) * (other.value as number));
		} else if (other instanceof RealAtom) {
			return new RealAtom((this._value as number) * (other.value as number));
		}
		throw new RuntimeError(`Cannot multiply INTEGER with unsupported type`);
	}

	divide(other: IntegerAtom | RealAtom): RealAtom {
		if (other instanceof IntegerAtom) {
			const divisor = other.value as number;
			if (divisor === 0) throw new RuntimeError(`Division by zero`);
			return new RealAtom((this._value as number) / divisor);
		} else if (other instanceof RealAtom) {
			const divisor = other.value as number;
			if (divisor === 0) throw new RuntimeError(`Division by zero`);
			return new RealAtom((this._value as number) / divisor);
		}
		throw new RuntimeError(`Cannot divide INTEGER with unsupported type`);
	}

	integerDivide(other: IntegerAtom): IntegerAtom {
		if (other instanceof IntegerAtom) {
			const divisor = other.value as number;
			if (divisor === 0) throw new RuntimeError(`Division by zero`);
			return new IntegerAtom(Math.floor((this._value as number) / divisor));
		}
		throw new RuntimeError(`Cannot perform integer division on INTEGER with unsupported type`);
	}

	mod(other: IntegerAtom): IntegerAtom {
		if (other instanceof IntegerAtom) {
			const divisor = other.value as number;
			if (divisor === 0) throw new RuntimeError(`Modulo by zero`);
			return new IntegerAtom((this._value as number) % divisor);
		}
		throw new RuntimeError(`Cannot perform modulo on INTEGER with unsupported type`);
	}
}

/**
 * Atom for real (floating-point) values
 */
export class RealAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.REAL;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'number') {
			throw new RuntimeError(`Expected REAL, got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		try {
			this.validateValue(value);
			return value;
		} catch {
			// Validation failed, try to convert
		}

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string' && !isNaN(Number(value))) {
			return Number(value);
		}

		throw new RuntimeError(`Cannot convert value '${String(value)}' of type ${typeof value} to REAL`);
	}

	copy(): VariableAtom {
		return new RealAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof RealAtom || other instanceof IntegerAtom) {
			const thisVal = this._value as number;
			const otherVal = other.value as number;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare REAL with unsupported type`);
	}

	// Arithmetic operations
	add(other: IntegerAtom | RealAtom): RealAtom {
		if (other instanceof IntegerAtom || other instanceof RealAtom) {
			return new RealAtom((this._value as number) + (other.value as number));
		}
		throw new RuntimeError(`Cannot add REAL with unsupported type`);
	}

	subtract(other: IntegerAtom | RealAtom): RealAtom {
		if (other instanceof IntegerAtom || other instanceof RealAtom) {
			return new RealAtom((this._value as number) - (other.value as number));
		}
		throw new RuntimeError(`Cannot subtract REAL with unsupported type`);
	}

	multiply(other: IntegerAtom | RealAtom): RealAtom {
		if (other instanceof IntegerAtom || other instanceof RealAtom) {
			return new RealAtom((this._value as number) * (other.value as number));
		}
		throw new RuntimeError(`Cannot multiply REAL with unsupported type`);
	}

	divide(other: IntegerAtom | RealAtom): RealAtom {
		if (other instanceof IntegerAtom || other instanceof RealAtom) {
			const divisor = other.value as number;
			if (divisor === 0) throw new RuntimeError(`Division by zero`);
			return new RealAtom((this._value as number) / divisor);
		}
		throw new RuntimeError(`Cannot divide REAL with unsupported type`);
	}
}

/**
 * Atom for character values
 */
export class CharAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.CHAR;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'string' || value.length !== 1) {
			throw new RuntimeError(`Expected CHAR (single character), got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		try {
			this.validateValue(value);
			return value;
		} catch {
			// Validation failed, try to convert
		}

		if (typeof value === 'string') {
			return value.charAt(0);
		}

		if (typeof value === 'number') {
			return String(value).charAt(0);
		}

		throw new RuntimeError(`Cannot convert value '${String(value)}' of type ${typeof value} to CHAR`);
	}

	copy(): VariableAtom {
		return new CharAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof CharAtom) {
			const thisVal = this._value as string;
			const otherVal = other.value as string;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare CHAR with unsupported type`);
	}
}

/**
 * Atom for string values
 */
export class StringAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.STRING;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'string') {
			throw new RuntimeError(`Expected STRING, got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		return String(value);
	}

	copy(): VariableAtom {
		return new StringAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof StringAtom) {
			const thisVal = this._value as string;
			const otherVal = other.value as string;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare STRING with unsupported type`);
	}
}

/**
 * Atom for boolean values
 */
export class BooleanAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.BOOLEAN;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'boolean') {
			throw new RuntimeError(`Expected BOOLEAN, got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		try {
			this.validateValue(value);
			return value;
		} catch {
			// Validation failed, try to convert
		}

		if (typeof value === 'string') {
			return value.toLowerCase() === 'true';
		}

		if (typeof value === 'number') {
			return value !== 0;
		}

		throw new RuntimeError(`Cannot convert value '${String(value)}' of type ${typeof value} to BOOLEAN`);
	}

	copy(): VariableAtom {
		return new BooleanAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof BooleanAtom) {
			const thisVal = this._value as boolean;
			const otherVal = other.value as boolean;

			if (thisVal === otherVal) return ComparisonResult.EQUAL;
			return thisVal ? ComparisonResult.GREATER_THAN : ComparisonResult.LESS_THAN;
		}

		throw new RuntimeError(`Cannot compare BOOLEAN with unsupported type`);
	}
}

/**
 * Atom for date values
 */
export class DateAtom extends VariableAtom {
	constructor(value: unknown, isConstant: boolean = false) {
		super(value, isConstant);
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): PseudocodeType {
		return PseudocodeType.DATE;
	}

	validateValue(value: unknown): void {
		if (!(value instanceof Date)) {
			throw new RuntimeError(`Expected DATE, got ${typeof value}`);
		}
	}

	convertValue(value: unknown): unknown {
		try {
			this.validateValue(value);
			return value;
		} catch {
			// Validation failed, try to convert
		}

		if (value instanceof Date) {
			return value;
		}

		if (typeof value === 'string') {
			return new Date(value);
		}

		if (typeof value === 'number') {
			return new Date(value);
		}

		throw new RuntimeError(`Cannot convert value '${String(value)}' of type ${typeof value} to DATE`);
	}

	copy(): VariableAtom {
		return new DateAtom(this._value, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof DateAtom) {
			const thisVal = this._value as Date;
			const otherVal = other.value as Date;

			if (thisVal < otherVal) return ComparisonResult.LESS_THAN;
			if (thisVal > otherVal) return ComparisonResult.GREATER_THAN;
			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare DATE with unsupported type`);
	}
}

/**
 * Atom for array values
 */
export class ArrayAtom extends VariableAtom {
	private _arrayType: ArrayTypeInfo;

	constructor(value: unknown, arrayType: ArrayTypeInfo, isConstant: boolean = false) {
		super(value, isConstant);
		this._arrayType = arrayType;
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): ArrayTypeInfo {
		return this._arrayType;
	}

	get elementType(): PseudocodeType {
		return this._arrayType.elementType;
	}

	get bounds(): Array<{ lower: number; upper: number }> {
		return this._arrayType.bounds;
	}

	validateValue(value: unknown): void {
		if (!Array.isArray(value)) {
			throw new RuntimeError(`Expected ARRAY, got ${typeof value}`);
		}

		// Check dimensions
		const expectedDimensions = this._arrayType.bounds.length;
		const actualDimensions = this.getArrayDimensions(value);

		if (expectedDimensions !== actualDimensions) {
			throw new RuntimeError(`Expected ${expectedDimensions}-dimensional array, got ${actualDimensions}-dimensional array`);
		}

		// Check bounds
		this.validateArrayBounds(value);

		// Check element types recursively
		this.validateArrayElements(value, this._arrayType.elementType, expectedDimensions);
	}

	convertValue(value: unknown): unknown {
		// For arrays, we'll validate but not automatically convert
		this.validateValue(value);
		return value;
	}

	copy(): VariableAtom {
		// Create a deep copy of the array
		const copiedValue = JSON.parse(JSON.stringify(this._value)) as unknown[];
		return new ArrayAtom(copiedValue, this._arrayType, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof ArrayAtom) {
			// Simple comparison based on array length and first element
			const thisArray = this._value as unknown[];
			const otherArray = other.value as unknown[];

			if (thisArray.length < otherArray.length) return ComparisonResult.LESS_THAN;
			if (thisArray.length > otherArray.length) return ComparisonResult.GREATER_THAN;

			// If lengths are equal, compare first elements (if any)
			if (thisArray.length > 0 && otherArray.length > 0) {
				// This is a simplified comparison - in a real implementation,
				// we might want to compare all elements or provide a more sophisticated comparison
				const thisFirst = thisArray[0];
				const otherFirst = otherArray[0];

				// For simplicity, we'll just convert to strings for comparison
				// In a real implementation, we would use the appropriate atom comparison
				const thisFirstStr = String(thisFirst);
				const otherFirstStr = String(otherFirst);

				if (thisFirstStr < otherFirstStr) return ComparisonResult.LESS_THAN;
				if (thisFirstStr > otherFirstStr) return ComparisonResult.GREATER_THAN;
			}

			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare ARRAY with unsupported type`);
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
	 * Validate array bounds
	 */
	private validateArrayBounds(array: unknown[]): void {
		this.validateArrayBoundsRecursive(array, 0);
	}

	/**
	 * Recursively validate array bounds
	 */
	private validateArrayBoundsRecursive(array: unknown[], dimension: number): void {
		if (dimension >= this._arrayType.bounds.length) {
			return;
		}

		const bound = this._arrayType.bounds[dimension];
		if (array.length < bound.lower || array.length > bound.upper) {
			throw new RuntimeError(`Array dimension ${dimension + 1} has ${array.length} elements, expected between ${bound.lower} and ${bound.upper}`);
		}

		if (dimension < this._arrayType.bounds.length - 1) {
			for (const element of array) {
				if (Array.isArray(element)) {
					this.validateArrayBoundsRecursive(element, dimension + 1);
				} else {
					throw new RuntimeError(`Expected ${this._arrayType.bounds.length - dimension} more dimensions`);
				}
			}
		}
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
}

/**
 * Atom for user-defined types
 */
export class UserDefinedAtom extends VariableAtom {
	private _userDefinedType: UserDefinedTypeInfo;

	constructor(value: unknown, userDefinedType: UserDefinedTypeInfo, isConstant: boolean = false) {
		super(value, isConstant);
		this._userDefinedType = userDefinedType;
		this.validateValue(value);
		this._value = this.convertValue(value);
	}

	get type(): UserDefinedTypeInfo {
		return this._userDefinedType;
	}

	get typeName(): string {
		return this._userDefinedType.name;
	}

	get fields(): Record<string, PseudocodeType | ArrayTypeInfo> {
		return this._userDefinedType.fields;
	}

	validateValue(value: unknown): void {
		if (typeof value !== 'object' || value === null) {
			throw new RuntimeError(`Expected user-defined type '${this._userDefinedType.name}', got ${typeof value}`);
		}

		// Check all fields
		for (const [fieldName, fieldType] of Object.entries(this._userDefinedType.fields)) {
			if (!(fieldName in value)) {
				throw new RuntimeError(`Missing field '${fieldName}' in user-defined type '${this._userDefinedType.name}'`);
			}

			this.validateFieldValue(value[fieldName as keyof typeof value], fieldType);
		}
	}

	convertValue(value: unknown): unknown {
		// For user-defined types, we'll validate but not automatically convert
		this.validateValue(value);
		return value;
	}

	copy(): VariableAtom {
		// Create a deep copy of the object
		const copiedValue = JSON.parse(JSON.stringify(this._value)) as Record<string, unknown>;
		return new UserDefinedAtom(copiedValue, this._userDefinedType, this._isConstant);
	}

	compareTo(other: VariableAtom): ComparisonResult {
		if (other instanceof UserDefinedAtom && other.typeName === this.typeName) {
			// Simple comparison based on field count and first field value
			const thisObj = this._value as Record<string, unknown>;
			const otherObj = other.value as Record<string, unknown>;

			const thisFields = Object.keys(thisObj);
			const otherFields = Object.keys(otherObj);

			if (thisFields.length < otherFields.length) return ComparisonResult.LESS_THAN;
			if (thisFields.length > otherFields.length) return ComparisonResult.GREATER_THAN;

			// If field counts are equal, compare first field values (if any)
			if (thisFields.length > 0 && otherFields.length > 0) {
				const thisFirstField = thisFields[0];
				const otherFirstField = otherFields[0];

				const thisFirstValue = thisObj[thisFirstField];
				const otherFirstValue = otherObj[otherFirstField];

				// For simplicity, we'll just convert to strings for comparison
				// In a real implementation, we would use the appropriate atom comparison
				const thisFirstValueStr = String(thisFirstValue);
				const otherFirstValueStr = String(otherFirstValue);

				if (thisFirstValueStr < otherFirstValueStr) return ComparisonResult.LESS_THAN;
				if (thisFirstValueStr > otherFirstValueStr) return ComparisonResult.GREATER_THAN;
			}

			return ComparisonResult.EQUAL;
		}

		throw new RuntimeError(`Cannot compare user-defined type '${this.typeName}' with unsupported type`);
	}

	/**
	 * Validate a field value
	 */
	private validateFieldValue(value: unknown, fieldType: PseudocodeType | ArrayTypeInfo): void {
		if (typeof fieldType === 'string') {
			// Simple type
			this.validateSimpleType(value, fieldType);
		} else if ('elementType' in fieldType) {
			// Array type
			if (!Array.isArray(value)) {
				throw new RuntimeError(`Expected ARRAY, got ${typeof value}`);
			}
			// For simplicity, we'll just validate the first dimension
			// In a real implementation, we would recursively validate all dimensions
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
}

/**
 * Factory class for creating VariableAtom instances
 */
export class VariableAtomFactory {
	/**
	 * Create a VariableAtom instance based on the type
	 */
	static createAtom(
		type: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo,
		value: unknown,
		isConstant: boolean = false
	): VariableAtom {
		if (typeof type === 'string') {
			// Simple type
			switch (type) {
				case PseudocodeType.INTEGER:
					return new IntegerAtom(value, isConstant);
				case PseudocodeType.REAL:
					return new RealAtom(value, isConstant);
				case PseudocodeType.CHAR:
					return new CharAtom(value, isConstant);
				case PseudocodeType.STRING:
					return new StringAtom(value, isConstant);
				case PseudocodeType.BOOLEAN:
					return new BooleanAtom(value, isConstant);
				case PseudocodeType.DATE:
					return new DateAtom(value, isConstant);
				default:
					throw new RuntimeError(`Unsupported type: ${type as string}`);
			}
		} else if ('elementType' in type) {
			// Array type
			return new ArrayAtom(value, type, isConstant);
		} else if ('name' in type) {
			// User-defined type
			return new UserDefinedAtom(value, type, isConstant);
		} else {
			throw new RuntimeError(`Unknown type structure`);
		}
	}
}

