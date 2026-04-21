import { PseudocodeType, TypeInfo } from "../types";
import { RuntimeError } from "../errors";
import { Heap, NULL_POINTER } from "./heap";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export enum ComparisonResult {
    LESS_THAN = -1,
    EQUAL = 0,
    GREATER_THAN = 1,
}

export class VariableAtom {
    address: number;
    type: TypeInfo;
    isConstant: boolean;
    isByRef: boolean;

    constructor(address: number, type: TypeInfo, isConstant: boolean = false, isByRef: boolean = false) {
        this.address = address;
        this.type = type;
        this.isConstant = isConstant;
        this.isByRef = isByRef;
    }

    getValue(heap: Heap): unknown {
        return heap.readUnsafe(this.address).value;
    }

    setValue(heap: Heap, value: unknown, line?: number, column?: number): void {
        if (this.isConstant) {
            throw new RuntimeError("Cannot assign to constant", line, column);
        }

        heap.write(this.address, value, this.type, line, column);
    }

    /**
     * Set value with Copy-on-Write semantics.
     * If the underlying object is shared (refCount > 1), creates a copy.
     * Updates the address if a new copy is created.
     */
    setValueCOW(heap: Heap, value: unknown, line?: number, column?: number): void {
        if (this.isConstant) {
            throw new RuntimeError("Cannot assign to constant", line, column);
        }

        this.address = heap.writeCOW(this.address, value, this.type, line, column);
    }

    getAddress(): number {
        return this.address;
    }

    static create(
        heap: Heap,
        type: TypeInfo,
        value: unknown,
        isConstant: boolean = false,
    ): VariableAtom {
        const address = heap.allocate(value, type, !isConstant);
        return new VariableAtom(address, type, isConstant);
    }

    static createForByRef(address: number, type: TypeInfo, heap: Heap): VariableAtom {
        heap.incrementRef(address);
        return new VariableAtom(address, type, false, true);
    }
}

export class VariableAtomFactory {
    static createAtom(
        type: TypeInfo,
        value: unknown,
        isConstant: boolean = false,
        heap: Heap,
        fromHeap: boolean = false,
    ): VariableAtom {
        const address = heap.allocate(value, type, !isConstant, fromHeap);
        return new VariableAtom(address, type, isConstant);
    }

    static getDefaultValue(type: TypeInfo): unknown {
        if (typeof type === "string") {
            switch (type) {
                case PseudocodeType.INTEGER:
                case PseudocodeType.REAL:
                    return 0;
                case PseudocodeType.CHAR:
                    return " ";
                case PseudocodeType.STRING:
                    return "";
                case PseudocodeType.BOOLEAN:
                    return false;
                case PseudocodeType.DATE:
                    return new Date(0);
                case PseudocodeType.ANY:
                    return null;
            }
        }

        if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
            return type.values[0] ?? "";
        }

        if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            return new Set();
        }

        if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
            return NULL_POINTER;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "CLASS") {
            return NULL_POINTER;
        }

        if (typeof type === "object" && "elementType" in type) {
            return [];
        }

        if (typeof type === "object" && "fields" in type) {
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = VariableAtomFactory.getDefaultValue(fieldType);
            }
            return result;
        }

        return undefined;
    }

    static validateValue(type: TypeInfo, value: unknown, line?: number, column?: number): void {
        if (typeof type === "string") {
            switch (type) {
                case PseudocodeType.INTEGER:
                    if (typeof value !== "number" || !Number.isInteger(value)) {
                        throw new RuntimeError(`Expected INTEGER, got ${typeof value}`, line, column);
                    }
                    break;
                case PseudocodeType.REAL:
                    if (typeof value !== "number") {
                        throw new RuntimeError(`Expected REAL, got ${typeof value}`, line, column);
                    }
                    break;
                case PseudocodeType.CHAR:
                    if (typeof value !== "string" || value.length !== 1) {
                        throw new RuntimeError(
                            `Expected CHAR (single character), got ${typeof value}`,
                            line,
                            column,
                        );
                    }
                    break;
                case PseudocodeType.STRING:
                    if (typeof value !== "string") {
                        throw new RuntimeError(`Expected STRING, got ${typeof value}`, line, column);
                    }
                    break;
                case PseudocodeType.BOOLEAN:
                    if (typeof value !== "boolean") {
                        throw new RuntimeError(`Expected BOOLEAN, got ${typeof value}`, line, column);
                    }
                    break;
                case PseudocodeType.DATE:
                    if (!(value instanceof Date)) {
                        throw new RuntimeError(`Expected DATE, got ${typeof value}`, line, column);
                    }
                    break;
                case PseudocodeType.ANY:
                    break;
            }
        } else if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
            if (typeof value !== "string" || !type.values.includes(value)) {
                throw new RuntimeError(`Expected enum '${type.name}' value`, line, column);
            }
        } else if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            if (!(value instanceof Set)) {
                throw new RuntimeError(`Expected SET '${type.name}'`, line, column);
            }
        } else if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
            if (typeof value !== "number" && value !== null) {
                throw new RuntimeError(`Expected POINTER, got ${typeof value}`, line, column);
            }
        } else if (typeof type === "object" && "kind" in type && type.kind === "INFERRED") {
        } else if (typeof type === "object" && "kind" in type && type.kind === "CLASS") {
            if (typeof value !== "number") {
                throw new RuntimeError(`Expected class '${type.name}', got ${typeof value}`, line, column);
            }
        } else if (typeof type === "object" && "elementType" in type) {
            if (!Array.isArray(value)) {
                throw new RuntimeError(`Expected ARRAY, got ${typeof value}`, line, column);
            }
        } else if (typeof type === "object" && "fields" in type) {
            if (!isRecord(value)) {
                throw new RuntimeError(
                    `Expected user-defined type '${type.name}', got ${typeof value}`,
                    line,
                    column,
                );
            }
        }
    }
}
