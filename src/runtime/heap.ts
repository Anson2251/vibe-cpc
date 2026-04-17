import { z } from "zod";
import { Result, ok, err } from "neverthrow";
import { PseudocodeType, ArrayTypeInfo, UserDefinedTypeInfo, TypeInfo } from "../types";
import { RuntimeError } from "../errors";

export const NULL_POINTER = 0;

export interface HeapObject {
    value: unknown;
    type: TypeInfo;
    refCount: number;
    isMutable: boolean;
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

export type HeapResult<T> = Result<T, RuntimeError>;

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
        };

        this.memory.set(address, obj);
        return address;
    }

    deallocate(address: number): HeapResult<void> {
        if (address === NULL_POINTER) {
            return ok(undefined);
        }

        const obj = this.memory.get(address);
        if (!obj) {
            return err(new RuntimeError(`Invalid memory address: ${address}`));
        }

        obj.refCount--;
        if (obj.refCount <= 0) {
            this.deallocateChildren(obj.value, obj.type);
            this.memory.delete(address);
            this.freeList.push(address);
        }

        return ok(undefined);
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

    read(address: number): HeapResult<HeapObject> {
        if (address === NULL_POINTER) {
            return err(new RuntimeError("Null pointer dereference"));
        }

        const obj = this.memory.get(address);
        if (!obj) {
            return err(new RuntimeError(`Invalid memory address: ${address}`));
        }
        return ok(obj);
    }

    write(address: number, value: unknown, type: TypeInfo): HeapResult<void> {
        if (address === NULL_POINTER) {
            return err(new RuntimeError("Cannot write to null pointer"));
        }

        const obj = this.memory.get(address);
        if (!obj) {
            return err(new RuntimeError(`Invalid memory address: ${address}`));
        }

        if (!obj.isMutable) {
            return err(new RuntimeError("Cannot modify constant"));
        }

        obj.value = this.deepCopyValue(value, type, true);
        return ok(undefined);
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

    decrementRef(address: number): HeapResult<void> {
        if (address === NULL_POINTER) {
            return ok(undefined);
        }

        const obj = this.memory.get(address);
        if (!obj) {
            return err(new RuntimeError(`Invalid memory address: ${address}`));
        }

        obj.refCount--;
        if (obj.refCount <= 0) {
            this.deallocateChildren(obj.value, obj.type);
            this.memory.delete(address);
            this.freeList.push(address);
        }

        return ok(undefined);
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

    readElementAddress(arrayAddress: number, index: number): HeapResult<number> {
        const arrayResult = this.read(arrayAddress);
        if (arrayResult.isErr()) {
            return err(arrayResult.error);
        }

        const arrayValue = arrayResult.value.value;
        if (!Array.isArray(arrayValue)) {
            return err(new RuntimeError("Array access on non-array value"));
        }

        if (index < 1 || index > arrayValue.length) {
            return err(new RuntimeError(`Array index out of bounds: ${index}`));
        }

        const elementAddress: unknown = arrayValue[index - 1];
        if (typeof elementAddress !== "number") {
            return err(new RuntimeError("Invalid array element address"));
        }

        return ok(elementAddress);
    }

    readFieldAddress(recordAddress: number, field: string): HeapResult<number> {
        const recordResult = this.read(recordAddress);
        if (recordResult.isErr()) {
            return err(recordResult.error);
        }

        const recordValue = recordResult.value.value;
        if (!isRecord(recordValue)) {
            return err(new RuntimeError("Record access on non-record value"));
        }

        const fieldAddress = recordValue[field];
        if (typeof fieldAddress !== "number") {
            return err(new RuntimeError(`Invalid field address for '${field}'`));
        }

        return ok(fieldAddress);
    }

    readAtAddress(address: number): HeapResult<unknown> {
        const result = this.read(address);
        if (result.isErr()) {
            return err(result.error);
        }
        return ok(result.value.value);
    }

    writeAtAddress(address: number, value: unknown, type: TypeInfo): HeapResult<void> {
        return this.write(address, value, type);
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

        if (typeof type === "object" && "elementType" in type) {
            if (Array.isArray(value)) {
                return this.deepCopyArray(value, type, fromHeap);
            }
            return value;
        }

        if (typeof type === "object" && "fields" in type) {
            if (isRecord(value)) {
                return this.deepCopyRecord(value, type, fromHeap);
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
                const newAddr = this.allocate(element, subArrayType);
                return newAddr;
            });
        }

        return array.map((element) => {
            if (fromHeap && typeof element === "number" && this.memory.has(element)) {
                const srcObj = this.memory.get(element)!;
                const newAddr = this.allocate(srcObj.value, srcObj.type, srcObj.isMutable, true);
                return newAddr;
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
                if (fromHeap && typeof fieldValue === "number" && this.memory.has(fieldValue)) {
                    const srcObj = this.memory.get(fieldValue)!;
                    const newAddr = this.allocate(
                        srcObj.value,
                        srcObj.type,
                        srcObj.isMutable,
                        true,
                    );
                    copy[fieldName] = newAddr;
                } else {
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

        if (typeof type === "object" && "elementType" in type) {
            return [];
        }

        if (typeof type === "object" && "fields" in type) {
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = this.getDefaultValue(fieldType);
            }
            return result;
        }

        return undefined;
    }
}

export function validateHeapObject(obj: unknown): HeapObject {
    return HeapObjectSchema.parse(obj);
}
