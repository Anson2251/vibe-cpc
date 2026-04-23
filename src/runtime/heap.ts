import { z } from "zod";
import { PseudocodeType, ArrayTypeInfo, UserDefinedTypeInfo, TypeInfo } from "../types";
import { RuntimeError } from "../errors";

export const NULL_POINTER = 0;

export interface HeapObject {
    value: unknown;
    type: TypeInfo;
    refCount: number;
    isMutable: boolean;
    arrayLowerBound?: number;
}

const TypeInfoSchema = z.custom<TypeInfo>((val) => {
    if (typeof val === "string") return true;
    if (typeof val === "object" && val !== null && "kind" in val) return true;
    if (typeof val === "object" && val !== null && "elementType" in val) return true;
    if (typeof val === "object" && val !== null && "fields" in val) return true;
    return false;
}, "Invalid TypeInfo");

const HeapObjectSchema = z
    .object({
        value: z.unknown(),
        refCount: z.number().int().nonnegative(),
        isMutable: z.boolean(),
        type: TypeInfoSchema,
    })
    .loose();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class Heap {
    private memory: Map<number, HeapObject> = new Map();
    private freeList: number[] = [];
    private nextAddress: number = 1;

    allocate(
        value: unknown,
        type: TypeInfo,
        isMutable: boolean = true,
        fromHeap: boolean = false,
    ): number {
        let address: number;

        if (this.freeList.length > 0) {
            address = this.freeList.pop()!;
        } else {
            address = this.nextAddress++;
        }

        const storedValue = this.deepCopyValue(value, type, fromHeap);

        const obj: HeapObject = {
            value: storedValue,
            type,
            refCount: 1,
            isMutable,
            arrayLowerBound: this.computeArrayLowerBound(type),
        };

        this.memory.set(address, obj);
        return address;
    }

    deallocate(address: number): void {
        if (address === NULL_POINTER) {
            return;
        }

        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }

        obj.refCount--;
        if (obj.refCount <= 0) {
            this.deallocateChildren(obj.value, obj.type);
            this.memory.delete(address);
            this.freeList.push(address);
        }
    }

    private deallocateChildren(value: unknown, type: TypeInfo): void {
        if (typeof type === "object" && "elementType" in type && Array.isArray(value)) {
            for (const addr of value) {
                if (typeof addr === "number") {
                    this.decrementRef(addr);
                }
            }
        }

        if (typeof type === "object" && "fields" in type && isRecord(value)) {
            for (const addr of Object.values(value)) {
                if (typeof addr === "number") {
                    this.decrementRef(addr);
                }
            }
        }
    }

    read(address: number): HeapObject {
        if (address === NULL_POINTER) {
            throw new RuntimeError("Null pointer dereference");
        }

        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }
        return obj;
    }

    write(address: number, value: unknown, type: TypeInfo): void {
        if (address === NULL_POINTER) {
            throw new RuntimeError("Cannot write to null pointer");
        }

        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }

        if (!obj.isMutable) {
            throw new RuntimeError("Cannot modify constant");
        }

        // For record types, value is a record object (not from heap), so fromHeap should be false
        const fromHeap = typeof value === "number" && this.memory.has(value);
        obj.value = this.deepCopyValue(value, type, fromHeap);
    }

    incrementRef(address: number): void {
        if (address === NULL_POINTER) {
            return;
        }

        const obj = this.memory.get(address);
        if (obj) {
            obj.refCount++;
        }
    }

    decrementRef(address: number): void {
        if (address === NULL_POINTER) {
            return;
        }

        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }

        obj.refCount--;
        if (obj.refCount <= 0) {
            this.deallocateChildren(obj.value, obj.type);
            this.memory.delete(address);
            this.freeList.push(address);
        }
    }

    decrementRefUnsafe(address: number): void {
        if (address === NULL_POINTER) {
            return;
        }

        const obj = this.memory.get(address);
        if (!obj) return;

        obj.refCount--;
        if (obj.refCount <= 0) {
            this.deallocateChildren(obj.value, obj.type);
            this.memory.delete(address);
            this.freeList.push(address);
        }
    }

    isNullPointer(address: number): boolean {
        return address === NULL_POINTER;
    }

    isValidAddress(address: number): boolean {
        return address === NULL_POINTER || this.memory.has(address);
    }

    getAllocatedCount(): number {
        return this.memory.size;
    }

    getSnapshot(): Map<number, HeapObject> {
        return new Map(this.memory);
    }

    readElementAddress(arrayAddress: number, index: number): number {
        const obj = this.read(arrayAddress);
        const arrayValue = obj.value;
        if (!Array.isArray(arrayValue)) {
            throw new RuntimeError("Array access on non-array value");
        }

        const lowerBound = this.getArrayLowerBound(obj);

        if (index < lowerBound || index > lowerBound + arrayValue.length - 1) {
            throw new RuntimeError(`Array index out of bounds: ${index}`);
        }

        const elementAddress: unknown = arrayValue[index - lowerBound];
        if (typeof elementAddress !== "number") {
            throw new RuntimeError("Invalid array element address");
        }

        return elementAddress;
    }

    readFieldAddress(recordAddress: number, field: string): number {
        const obj = this.read(recordAddress);
        const recordValue = obj.value;
        if (!isRecord(recordValue)) {
            throw new RuntimeError("Record access on non-record value");
        }

        if (!(field in recordValue)) {
            throw new RuntimeError(`Unknown field '${field}'`);
        }

        const fieldAddress = recordValue[field];
        if (typeof fieldAddress !== "number") {
            throw new RuntimeError(`Invalid field address for '${field}'`);
        }

        return fieldAddress;
    }

    readAtAddress(address: number): unknown {
        return this.read(address).value;
    }

    writeAtAddress(address: number, value: unknown, type: TypeInfo): void {
        this.write(address, value, type);
    }

    readUnsafe(address: number): HeapObject {
        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }
        return obj;
    }

    writeUnsafe(address: number, value: unknown, type: TypeInfo): void {
        const obj = this.memory.get(address);
        if (!obj) {
            throw new RuntimeError(`Invalid memory address: ${address}`);
        }

        if (!obj.isMutable) {
            throw new RuntimeError("Cannot modify constant");
        }

        const fromHeap = typeof value === "number" && this.memory.has(value);
        obj.value = this.deepCopyValue(value, type, fromHeap);
    }

    readElementAddressUnsafe(arrayAddress: number, index: number): number {
        const obj = this.readUnsafe(arrayAddress);
        const arrayValue = obj.value;
        if (!Array.isArray(arrayValue)) {
            throw new RuntimeError("Array access on non-array value");
        }

        const lowerBound = this.getArrayLowerBound(obj);

        if (index < lowerBound || index > lowerBound + arrayValue.length - 1) {
            throw new RuntimeError(`Array index out of bounds: ${index}`);
        }

        const elementAddress: unknown = arrayValue[index - lowerBound];
        if (typeof elementAddress !== "number") {
            throw new RuntimeError("Invalid array element address");
        }

        return elementAddress;
    }

    readFieldAddressUnsafe(recordAddress: number, field: string): number {
        const obj = this.readUnsafe(recordAddress);
        const recordValue = obj.value;
        if (!isRecord(recordValue)) {
            throw new RuntimeError("Record access on non-record value");
        }

        if (!(field in recordValue)) {
            throw new RuntimeError(`Unknown field '${field}'`);
        }

        const fieldAddress = recordValue[field];
        if (typeof fieldAddress !== "number") {
            throw new RuntimeError(`Invalid field address for '${field}'`);
        }

        return fieldAddress;
    }

    deepCopyValue(value: unknown, type: TypeInfo, fromHeap: boolean = false): unknown {
        if (value === null || value === undefined) {
            return this.getDefaultValue(type);
        }

        if (typeof type === "string") {
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            if (value instanceof Set) {
                return new Set(value);
            }
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "CLASS") {
            if (isRecord(value)) {
                return this.deepCopyRecord(value, type as UserDefinedTypeInfo, fromHeap);
            }
            return value;
        }

        if (typeof type === "object" && "elementType" in type) {
            if (Array.isArray(value)) {
                return this.deepCopyArray(value, type, fromHeap);
            }
            // If value is a heap address (for array variables), read and copy the array
            if (typeof value === "number" && this.memory.has(value)) {
                const srcObj = this.memory.get(value)!;
                if (Array.isArray(srcObj.value)) {
                    return this.deepCopyArray(srcObj.value, type, true);
                }
            }
            return value;
        }

        if (typeof type === "object" && "fields" in type) {
            if (isRecord(value)) {
                return this.deepCopyRecord(value, type, fromHeap);
            }
            // If value is a heap address (for record variables), read and copy the record
            if (typeof value === "number" && this.memory.has(value)) {
                const srcObj = this.memory.get(value)!;
                if (isRecord(srcObj.value)) {
                    return this.deepCopyRecord(srcObj.value, type, true);
                }
            }
            return value;
        }

        return value;
    }

    private deepCopyArray(array: unknown[], type: ArrayTypeInfo, fromHeap: boolean): unknown[] {
        if (type.bounds.length > 1) {
            const subArrayType: ArrayTypeInfo = {
                elementType: type.elementType,
                bounds: type.bounds.slice(1),
            };
            return array.map((element) => {
                if (fromHeap && typeof element === "number" && this.memory.has(element)) {
                    const srcObj = this.memory.get(element)!;
                    const newAddr = this.allocate(
                        srcObj.value,
                        srcObj.type,
                        srcObj.isMutable,
                        true,
                    );
                    return newAddr;
                }
                // Handle nested arrays (multi-dimensional arrays created by getDefaultValue)
                if (Array.isArray(element)) {
                    const copiedSubArray = this.deepCopyArray(element, subArrayType, fromHeap);
                    const newAddr = this.allocate(copiedSubArray, subArrayType);
                    return newAddr;
                }
                const newAddr = this.allocate(element, subArrayType);
                return newAddr;
            });
        }

        return array.map((element) => {
            if (typeof element === "number" && this.memory.has(element)) {
                const srcObj = this.memory.get(element)!;
                // If element is a record/object in heap, deep copy it
                if (typeof srcObj.type === "object" && srcObj.type !== null && "fields" in srcObj.type) {
                    const recordValue = srcObj.value;
                    if (isRecord(recordValue)) {
                        const copiedRecord = this.deepCopyRecord(recordValue, srcObj.type as UserDefinedTypeInfo, true);
                        const newAddr = this.allocate(copiedRecord, srcObj.type, srcObj.isMutable, false);
                        return newAddr;
                    }
                }
                if (fromHeap) {
                    const newAddr = this.allocate(srcObj.value, srcObj.type, srcObj.isMutable, true);
                    return newAddr;
                }
            }
            const newAddr = this.allocate(element, type.elementType);
            return newAddr;
        });
    }

    private deepCopyRecord(
        record: Record<string, unknown>,
        type: UserDefinedTypeInfo,
        fromHeap: boolean,
    ): Record<string, unknown> {
        const copy: Record<string, unknown> = {};
        for (const [fieldName, fieldType] of Object.entries(type.fields)) {
            if (fieldName in record) {
                const fieldValue = record[fieldName];
                // Check if fieldValue is a heap address (for record fields)
                if (typeof fieldValue === "number" && this.memory.has(fieldValue)) {
                    const fieldObj = this.memory.get(fieldValue)!;
                    if (typeof fieldObj.type === "object" && fieldObj.type !== null && "fields" in fieldObj.type) {
                        // Nested record - recursively copy
                        if (isRecord(fieldObj.value)) {
                            const copiedNested = this.deepCopyRecord(fieldObj.value, fieldObj.type as UserDefinedTypeInfo, true);
                            const newAddr = this.allocate(copiedNested, fieldObj.type, fieldObj.isMutable, false);
                            copy[fieldName] = newAddr;
                        } else {
                            copy[fieldName] = fieldValue;
                        }
                    } else {
                        // Simple field - copy the actual value (not the address)
                        const newAddr = this.allocate(
                            fieldObj.value,
                            fieldObj.type,
                            fieldObj.isMutable,
                            true,
                        );
                        copy[fieldName] = newAddr;
                    }
                } else {
                    // Field value is not a heap address, allocate it directly
                    const newAddr = this.allocate(fieldValue, fieldType);
                    copy[fieldName] = newAddr;
                }
            } else {
                const newAddr = this.allocate(this.getDefaultValue(fieldType), fieldType);
                copy[fieldName] = newAddr;
            }
        }
        return copy;
    }

    getDefaultValue(type: TypeInfo): unknown {
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
            const size = type.bounds.reduce(
                (acc: number, b: { lower: number | string; upper: number | string }) => {
                    const lower = typeof b.lower === "number" ? b.lower : 1;
                    const upper = typeof b.upper === "number" ? b.upper : 1;
                    return acc * (upper - lower + 1);
                },
                1,
            );
            if (type.bounds.length > 1) {
                const subArrayType: ArrayTypeInfo = {
                    elementType: type.elementType,
                    bounds: type.bounds.slice(1),
                };
                return Array.from({ length: size }, () => this.getDefaultValue(subArrayType));
            }
            return Array.from({ length: size }, () => this.getDefaultValue(type.elementType));
        }

        if (typeof type === "object" && "fields" in type) {
            // For record types, allocate on heap and return address
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = this.getDefaultValue(fieldType);
            }
            // Allocate the record object on heap and return its address
            const address = this.allocate(result, type, true, false);
            return address;
        }

        return undefined;
    }

    private getArrayLowerBound(obj: HeapObject): number {
        if (obj.arrayLowerBound !== undefined) {
            return obj.arrayLowerBound;
        }
        return 1;
    }

    private computeArrayLowerBound(type: TypeInfo): number | undefined {
        if (typeof type === "object" && type !== null && "bounds" in type) {
            const arrayType = type as { bounds: unknown[] };
            if (arrayType.bounds.length > 0) {
                const firstBound = arrayType.bounds[0];
                if (
                    typeof firstBound === "object" &&
                    firstBound !== null &&
                    "lower" in firstBound
                ) {
                    const bound = firstBound as { lower: unknown };
                    if (typeof bound.lower === "number") {
                        return bound.lower;
                    }
                }
            }
        }
        return undefined;
    }
}

export function validateHeapObject(obj: unknown): HeapObject {
    return HeapObjectSchema.parse(obj);
}
