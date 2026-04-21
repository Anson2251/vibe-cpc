import { RuntimeError, IndexError } from "../errors";
import { Heap, HeapObject } from "./heap";
import { ArrayTypeInfo } from "../types";

function getArrayAddressFromHeapObj(heapObj: HeapObject, index: number, line?: number, column?: number): number {
    const arr: unknown[] = Array.isArray(heapObj.value) ? heapObj.value : [];
    const addr = arr[index];
    if (typeof addr !== "number") {
        throw new RuntimeError("Expected address in array", line, column);
    }
    return addr;
}

export function computeArrayAddress(
    baseAddress: number,
    arrayType: ArrayTypeInfo,
    indices: number[],
    heap: Heap,
    line?: number,
    column?: number,
): number {
    let currentAddress = baseAddress;

    for (let dim = 0; dim < indices.length; dim++) {
        const bound = arrayType.bounds[dim];
        if (!bound) {
            throw new RuntimeError("Array dimension mismatch", line, column);
        }

        const lower = typeof bound.lower === "number" ? bound.lower : 1;
        const upper = typeof bound.upper === "number" ? bound.upper : 1;
        const size = upper - lower + 1;
        const index = indices[dim] - lower;

        if (index < 0 || index >= size) {
            throw new RuntimeError(`Array index out of bounds: ${indices[dim]}`, line, column);
        }

        if (dim < indices.length - 1) {
            const remainingDims = arrayType.bounds.slice(dim + 1);
            let subArraySize = 1;
            for (const b of remainingDims) {
                const l = typeof b.lower === "number" ? b.lower : 1;
                const u = typeof b.upper === "number" ? b.upper : 1;
                subArraySize *= u - l + 1;
            }

            const heapObj = heap.readUnsafe(currentAddress, line, column);
            currentAddress = getArrayAddressFromHeapObj(heapObj, index * subArraySize, line, column);
        } else {
            const heapObj = heap.readUnsafe(currentAddress, line, column);
            currentAddress = getArrayAddressFromHeapObj(heapObj, index, line, column);
        }
    }

    return currentAddress;
}

export function resolveIndices(indices: unknown[], line?: number, column?: number): number[] {
    return indices.map((value) => {
        const num = ensureNumber(value, line, column);
        if (!Number.isInteger(num)) {
            throw new IndexError("Array index must be INTEGER", line, column);
        }
        return num;
    });
}

function ensureNumber(value: unknown, line?: number, column?: number): number {
    if (typeof value !== "number") {
        throw new RuntimeError("Expected numeric value", line, column);
    }
    return value;
}
