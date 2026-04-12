/**
 * Type Definitions for CAIE Pseudocode Interpreter
 *
 * This module defines the type system for the CAIE pseudocode language,
 * mapping pseudocode types to TypeScript types and providing type validation.
 */

/**
 * CAIE Pseudocode Data Types
 */
export enum PseudocodeType {
    INTEGER = "INTEGER",
    REAL = "REAL",
    CHAR = "CHAR",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    DATE = "DATE",
}

/**
 * Mapping from CAIE pseudocode types to TypeScript types
 */
export const PSEUDOCODE_TO_TYPESCRIPT_MAPPING: Record<PseudocodeType, string> = {
    [PseudocodeType.INTEGER]: "number",
    [PseudocodeType.REAL]: "number",
    [PseudocodeType.CHAR]: "string",
    [PseudocodeType.STRING]: "string",
    [PseudocodeType.BOOLEAN]: "boolean",
    [PseudocodeType.DATE]: "Date",
};

/**
 * Type validation utilities
 */
export class TypeValidator {
    /**
     * Map a pseudocode type to its corresponding TypeScript type
     */
    static mapPseudocodeToType(pseudocodeType: PseudocodeType): string {
        return PSEUDOCODE_TO_TYPESCRIPT_MAPPING[pseudocodeType] || "any";
    }

    /**
     * Check if a pseudocode type is compatible with another
     */
    static isCompatible(expectedType: PseudocodeType, actualType: PseudocodeType): boolean {
        if (expectedType === actualType) return true;

        // Allow INTEGER to REAL conversion (widening)
        if (expectedType === PseudocodeType.REAL && actualType === PseudocodeType.INTEGER)
            return true;

        return false;
    }

    /**
     * Validate that a value matches the expected pseudocode type
     */
    static validateValue(value: unknown, expectedType: PseudocodeType): boolean {
        switch (expectedType) {
            case PseudocodeType.INTEGER:
                return typeof value === "number" && Number.isInteger(value);
            case PseudocodeType.REAL:
                return typeof value === "number";
            case PseudocodeType.CHAR:
                return typeof value === "string" && value.length === 1;
            case PseudocodeType.STRING:
                return typeof value === "string";
            case PseudocodeType.BOOLEAN:
                return typeof value === "boolean";
            case PseudocodeType.DATE:
                return value instanceof Date;
            default:
                return true;
        }
    }

    /**
     * Convert a value to the specified pseudocode type
     */
    static convertValue(value: unknown, targetType: PseudocodeType): unknown {
        if (this.validateValue(value, targetType)) {
            return value;
        }

        switch (targetType) {
            case PseudocodeType.INTEGER:
                if (typeof value === "number") {
                    return Math.floor(value);
                }
                if (typeof value === "string" && !isNaN(Number(value))) {
                    return Math.floor(Number(value));
                }
                break;
            case PseudocodeType.REAL:
                if (typeof value === "number") {
                    return value;
                }
                if (typeof value === "string" && !isNaN(Number(value))) {
                    return Number(value);
                }
                break;
            case PseudocodeType.CHAR:
                if (typeof value === "string") {
                    return value.charAt(0);
                }
                if (typeof value === "number") {
                    return String(value).charAt(0);
                }
                break;
            case PseudocodeType.STRING:
                return String(value);
            case PseudocodeType.BOOLEAN:
                if (typeof value === "boolean") {
                    return value;
                }
                if (typeof value === "string") {
                    return value.toLowerCase() === "true";
                }
                if (typeof value === "number") {
                    return value !== 0;
                }
                break;
            case PseudocodeType.DATE:
                if (value instanceof Date) {
                    return value;
                }
                if (typeof value === "string") {
                    return new Date(value);
                }
                if (typeof value === "number") {
                    return new Date(value);
                }
                break;
        }

        throw new Error(
            `Cannot convert value '${String(value)}' of type ${typeof value} to ${targetType}`,
        );
    }
}

/**
 * Array type information
 */
export interface ArrayTypeInfo {
    elementType: TypeInfo;
    bounds: ArrayBound[]; // Array of lower:upper bounds for each dimension
}

export type ArrayBoundValue = number | string;

export interface EnumTypeInfo {
    kind: "ENUM";
    name: string;
    values: string[];
}

export interface SetTypeInfo {
    kind: "SET";
    name: string;
    elementType: PseudocodeType;
}

export type TypeInfo =
    | PseudocodeType
    | ArrayTypeInfo
    | UserDefinedTypeInfo
    | EnumTypeInfo
    | SetTypeInfo;

/**
 * Array bound information for a single dimension
 */
export interface ArrayBound {
    lower: ArrayBoundValue;
    upper: ArrayBoundValue;
}

/**
 * User-defined type information
 */
export interface UserDefinedTypeInfo {
    name: string;
    fields: Record<string, TypeInfo>;
}

/**
 * Variable information
 */
export interface VariableInfo {
    name: string;
    type: TypeInfo;
    value: unknown;
    isConstant: boolean;
}

/**
 * Parameter passing modes
 */
export enum ParameterMode {
    BY_VALUE = "BYVAL",
    BY_REFERENCE = "BYREF",
}

/**
 * Parameter information
 */
export interface ParameterInfo {
    name: string;
    type: TypeInfo;
    mode: ParameterMode;
}

/**
 * Procedure/function signature
 */
export interface RoutineSignature {
    name: string;
    parameters: ParameterInfo[];
    returnType?: TypeInfo; // Only for functions
}
