import { Heap, NULL_POINTER, validateHeapObject } from "../../../src/runtime/heap";
import { PseudocodeType } from "../../../src/types";
import { RuntimeError } from "../../../src/errors";

describe("Heap", () => {
    let heap: Heap;

    beforeEach(() => {
        heap = new Heap();
    });

    describe("allocate", () => {
        test("allocates memory and returns address", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(addr).toBeGreaterThan(0);
            expect(heap.getAllocatedCount()).toBe(1);
        });

        test("allocates sequential addresses", () => {
            const addr1 = heap.allocate(1, PseudocodeType.INTEGER);
            const addr2 = heap.allocate(2, PseudocodeType.INTEGER);
            expect(addr2).toBe(addr1 + 1);
        });

        test("deep copies values on allocation", () => {
            const arr = [1, 2, 3];
            const addr = heap.allocate(arr, { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            arr[0] = 999;
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                const stored = obj.value.value as number[];
                expect(stored.length).toBe(3);
                const elemAddr = stored[0];
                const elemObj = heap.read(elemAddr as number);
                expect(elemObj.isOk()).toBe(true);
                if (elemObj.isOk()) {
                    expect(elemObj.value.value).toBe(1);
                }
            }
        });

        test("allocates with default mutability", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                expect(obj.value.isMutable).toBe(true);
            }
        });

        test("allocates with explicit immutability", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                expect(obj.value.isMutable).toBe(false);
            }
        });
    });

    describe("read", () => {
        test("reads allocated value", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const result = heap.read(addr);
            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.value).toBe(42);
                expect(result.value.type).toBe(PseudocodeType.INTEGER);
                expect(result.value.refCount).toBe(1);
            }
        });

        test("returns error for null pointer read", () => {
            const result = heap.read(NULL_POINTER);
            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.error.message).toContain("Null pointer dereference");
            }
        });

        test("returns error for invalid address", () => {
            const result = heap.read(9999);
            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.error.message).toContain("Invalid memory address");
            }
        });
    });

    describe("write", () => {
        test("writes value to allocated address", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const writeResult = heap.write(addr, 100, PseudocodeType.INTEGER);
            expect(writeResult.isOk()).toBe(true);

            const readResult = heap.read(addr);
            expect(readResult.isOk()).toBe(true);
            if (readResult.isOk()) {
                expect(readResult.value.value).toBe(100);
            }
        });

        test("returns error for null pointer write", () => {
            const result = heap.write(NULL_POINTER, 42, PseudocodeType.INTEGER);
            expect(result.isErr()).toBe(true);
        });

        test("returns error for invalid address write", () => {
            const result = heap.write(9999, 42, PseudocodeType.INTEGER);
            expect(result.isErr()).toBe(true);
        });

        test("returns error for immutable write", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            const result = heap.write(addr, 100, PseudocodeType.INTEGER);
            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.error.message).toContain("Cannot modify constant");
            }
        });

        test("deep copies on write", () => {
            const addr = heap.allocate([1, 2, 3], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const newArr = [10, 20, 30];
            heap.write(addr, newArr, { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            newArr[0] = 999;

            const result = heap.read(addr);
            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const stored = result.value.value as number[];
                const elemAddr = stored[0];
                const elemObj = heap.read(elemAddr as number);
                expect(elemObj.isOk()).toBe(true);
                if (elemObj.isOk()) {
                    expect(elemObj.value.value).toBe(10);
                }
            }
        });
    });

    describe("deallocate", () => {
        test("decrements refCount on deallocate", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            const obj1 = heap.read(addr);
            expect(obj1.isOk()).toBe(true);
            if (obj1.isOk()) {
                expect(obj1.value.refCount).toBe(2);
            }

            const result = heap.deallocate(addr);
            expect(result.isOk()).toBe(true);
            const obj2 = heap.read(addr);
            expect(obj2.isOk()).toBe(true);
            if (obj2.isOk()) {
                expect(obj2.value.refCount).toBe(1);
            }
        });

        test("frees memory when refCount reaches zero", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(heap.getAllocatedCount()).toBe(1);

            const result = heap.deallocate(addr);
            expect(result.isOk()).toBe(true);
            expect(heap.getAllocatedCount()).toBe(0);

            const readResult = heap.read(addr);
            expect(readResult.isErr()).toBe(true);
        });

        test("reuses freed addresses", () => {
            const addr1 = heap.allocate(1, PseudocodeType.INTEGER);
            heap.deallocate(addr1);
            const addr2 = heap.allocate(2, PseudocodeType.INTEGER);
            expect(addr2).toBe(addr1);
        });

        test("returns ok for null pointer deallocate", () => {
            const result = heap.deallocate(NULL_POINTER);
            expect(result.isOk()).toBe(true);
        });

        test("returns error for invalid address deallocate", () => {
            const result = heap.deallocate(9999);
            expect(result.isErr()).toBe(true);
        });
    });

    describe("reference counting", () => {
        test("incrementRef increases refCount", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                expect(obj.value.refCount).toBe(2);
            }
        });

        test("decrementRef decreases refCount", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            heap.decrementRef(addr);
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                expect(obj.value.refCount).toBe(1);
            }
        });

        test("decrementRef frees memory when refCount reaches zero", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.decrementRef(addr);
            expect(heap.getAllocatedCount()).toBe(0);
        });

        test("incrementRef on null pointer is no-op", () => {
            expect(() => heap.incrementRef(NULL_POINTER)).not.toThrow();
        });

        test("decrementRef on null pointer returns ok", () => {
            const result = heap.decrementRef(NULL_POINTER);
            expect(result.isOk()).toBe(true);
        });
    });

    describe("null pointer", () => {
        test("NULL_POINTER is zero", () => {
            expect(NULL_POINTER).toBe(0);
        });

        test("isNullPointer returns true for zero", () => {
            expect(heap.isNullPointer(0)).toBe(true);
        });

        test("isNullPointer returns false for non-zero", () => {
            expect(heap.isNullPointer(1)).toBe(false);
        });

        test("isValidAddress returns true for null pointer", () => {
            expect(heap.isValidAddress(NULL_POINTER)).toBe(true);
        });

        test("isValidAddress returns true for allocated address", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(heap.isValidAddress(addr)).toBe(true);
        });

        test("isValidAddress returns false for unallocated address", () => {
            expect(heap.isValidAddress(9999)).toBe(false);
        });
    });

    describe("deep copy", () => {
        test("deep copies arrays", () => {
            const arr = [1, 2, 3];
            const addr = heap.allocate(arr, { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                const stored = obj.value.value as number[];
                expect(stored.length).toBe(3);
                expect(stored).not.toBe(arr);
                const elem0 = heap.read(stored[0] as number);
                const elem1 = heap.read(stored[1] as number);
                const elem2 = heap.read(stored[2] as number);
                expect(elem0.isOk() && elem0.value.value).toBe(1);
                expect(elem1.isOk() && elem1.value.value).toBe(2);
                expect(elem2.isOk() && elem2.value.value).toBe(3);
            }
        });

        test("deep copies records", () => {
            const record = { name: "Alice", age: 30 };
            const addr = heap.allocate(record, {
                name: "Person",
                fields: {
                    name: PseudocodeType.STRING,
                    age: PseudocodeType.INTEGER,
                },
            });
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                const stored = obj.value.value as Record<string, unknown>;
                expect(stored).not.toBe(record);
                const nameAddr = stored.name as number;
                const ageAddr = stored.age as number;
                const nameObj = heap.read(nameAddr);
                const ageObj = heap.read(ageAddr);
                expect(nameObj.isOk() && nameObj.value.value).toBe("Alice");
                expect(ageObj.isOk() && ageObj.value.value).toBe(30);
            }
        });

        test("deep copies sets", () => {
            const set = new Set([1, 2, 3]);
            const addr = heap.allocate(set, { kind: "SET", name: "IntSet", elementType: PseudocodeType.INTEGER });
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                const stored = obj.value.value as Set<number>;
                expect(stored.has(1)).toBe(true);
                expect(stored.has(2)).toBe(true);
                expect(stored.has(3)).toBe(true);
                expect(stored).not.toBe(set);
            }
        });

        test("does not deep copy pointer values", () => {
            const ptrValue = 42;
            const addr = heap.allocate(ptrValue, { kind: "POINTER", name: "^INTEGER", pointedType: PseudocodeType.INTEGER });
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                expect(obj.value.value).toBe(42);
            }
        });
    });

    describe("getSnapshot", () => {
        test("returns copy of memory", () => {
            heap.allocate(42, PseudocodeType.INTEGER);
            heap.allocate(100, PseudocodeType.INTEGER);
            const snapshot = heap.getSnapshot();
            expect(snapshot.size).toBe(2);
        });

        test("snapshot reflects current heap state", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const snapshot = heap.getSnapshot();
            const obj = snapshot.get(addr);
            expect(obj?.value).toBe(42);
            heap.write(addr, 100, PseudocodeType.INTEGER);
            expect(obj?.value).toBe(100);
        });

        test("snapshot reflects current heap state for arrays", () => {
            const addr = heap.allocate([1, 2, 3], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const snapshot = heap.getSnapshot();
            const obj = snapshot.get(addr);
            const stored = obj?.value as number[];
            const elemAddr = stored[0];
            const elemObj = snapshot.get(elemAddr as number);
            expect(elemObj?.value).toBe(1);
        });
    });

    describe("validateHeapObject", () => {
        test("validates valid heap object", () => {
            const obj = { value: 42, type: PseudocodeType.INTEGER, refCount: 1, isMutable: true };
            expect(() => validateHeapObject(obj)).not.toThrow();
        });

        test("rejects object with negative refCount", () => {
            const obj = { value: 42, type: PseudocodeType.INTEGER, refCount: -1, isMutable: true };
            expect(() => validateHeapObject(obj)).toThrow();
        });

        test("rejects object with non-boolean isMutable", () => {
            const obj = { value: 42, type: PseudocodeType.INTEGER, refCount: 1, isMutable: "yes" };
            expect(() => validateHeapObject(obj)).toThrow();
        });
    });

    describe("fromHeap deep copy", () => {
        test("allocates raw integer array without fromHeap", () => {
            const addr = heap.allocate([10, 20, 30], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] }, true, false);
            const obj = heap.read(addr);
            expect(obj.isOk()).toBe(true);
            if (obj.isOk()) {
                const stored = obj.value.value as number[];
                const elem0 = heap.read(stored[0] as number);
                const elem1 = heap.read(stored[1] as number);
                const elem2 = heap.read(stored[2] as number);
                expect(elem0.isOk() && elem0.value.value).toBe(10);
                expect(elem1.isOk() && elem1.value.value).toBe(20);
                expect(elem2.isOk() && elem2.value.value).toBe(30);
            }
        });

        test("deep copies array elements as addresses with fromHeap", () => {
            const srcAddr = heap.allocate([10, 20, 30], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] }, true, true);
            const copyObj = heap.read(copyAddr);
            expect(copyObj.isOk()).toBe(true);
            if (copyObj.isOk()) {
                const stored = copyObj.value.value as number[];
                const elem0 = heap.read(stored[0] as number);
                const elem1 = heap.read(stored[1] as number);
                const elem2 = heap.read(stored[2] as number);
                expect(elem0.isOk() && elem0.value.value).toBe(10);
                expect(elem1.isOk() && elem1.value.value).toBe(20);
                expect(elem2.isOk() && elem2.value.value).toBe(30);
            }
        });

        test("fromHeap deep copy produces independent copies", () => {
            const srcAddr = heap.allocate([10, 20, 30], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] }, true, true);

            const copyRead = heap.read(copyAddr);
            expect(copyRead.isOk()).toBe(true);
            if (!copyRead.isOk()) return;
            const copyStored = copyRead.value.value as number[];
            const copyElem0Addr = copyStored[0] as number;
            heap.write(copyElem0Addr, 999, PseudocodeType.INTEGER);

            const srcRead = heap.read(srcAddr);
            expect(srcRead.isOk()).toBe(true);
            if (!srcRead.isOk()) return;
            const srcStored = srcRead.value.value as number[];
            const srcElem0Addr = srcStored[0] as number;
            const srcElem0 = heap.read(srcElem0Addr);
            expect(srcElem0.isOk() && srcElem0.value.value).toBe(10);
        });

        test("deep copies record fields as addresses with fromHeap", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER } };
            const srcAddr = heap.allocate({ name: "Alice", age: 30 }, recordType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, recordType, true, true);
            const copyObj = heap.read(copyAddr);
            expect(copyObj.isOk()).toBe(true);
            if (copyObj.isOk()) {
                const stored = copyObj.value.value as Record<string, unknown>;
                const nameAddr = stored.name as number;
                const ageAddr = stored.age as number;
                const nameObj = heap.read(nameAddr);
                const ageObj = heap.read(ageAddr);
                expect(nameObj.isOk() && nameObj.value.value).toBe("Alice");
                expect(ageObj.isOk() && ageObj.value.value).toBe(30);
            }
        });

        test("fromHeap record deep copy produces independent copies", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER } };
            const srcAddr = heap.allocate({ name: "Alice", age: 30 }, recordType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, recordType, true, true);

            const copyRead = heap.read(copyAddr);
            expect(copyRead.isOk()).toBe(true);
            if (!copyRead.isOk()) return;
            const copyStored = copyRead.value.value as Record<string, unknown>;
            const copyAgeAddr = copyStored.age as number;
            heap.write(copyAgeAddr, 99, PseudocodeType.INTEGER);

            const srcRead = heap.read(srcAddr);
            expect(srcRead.isOk()).toBe(true);
            if (!srcRead.isOk()) return;
            const srcStored = srcRead.value.value as Record<string, unknown>;
            const srcAgeAddr = srcStored.age as number;
            const srcAge = heap.read(srcAgeAddr);
            expect(srcAge.isOk() && srcAge.value.value).toBe(30);
        });

        test("deep copies nested array in record with fromHeap", () => {
            const recordType = {
                name: "Container",
                fields: {
                    items: { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 2 }] },
                },
            };
            const srcAddr = heap.allocate({ items: [5, 10] }, recordType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, recordType, true, true);
            const copyObj = heap.read(copyAddr);
            expect(copyObj.isOk()).toBe(true);
            if (copyObj.isOk()) {
                const stored = copyObj.value.value as Record<string, unknown>;
                const itemsAddr = stored.items as number;
                const itemsObj = heap.read(itemsAddr);
                expect(itemsObj.isOk()).toBe(true);
                if (itemsObj.isOk()) {
                    const items = itemsObj.value.value as number[];
                    const elem0 = heap.read(items[0] as number);
                    const elem1 = heap.read(items[1] as number);
                    expect(elem0.isOk() && elem0.value.value).toBe(5);
                    expect(elem1.isOk() && elem1.value.value).toBe(10);
                }
            }
        });

        test("deep copies 2D array with fromHeap", () => {
            const array2dType = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 2 }, { lower: 1, upper: 2 }] };
            const srcAddr = heap.allocate([[1, 2], [3, 4]], array2dType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const srcValue = srcObj.value.value;
            const copyAddr = heap.allocate(srcValue, array2dType, true, true);
            const copyObj = heap.read(copyAddr);
            expect(copyObj.isOk()).toBe(true);
            if (copyObj.isOk()) {
                const stored = copyObj.value.value as number[];
                const row0Addr = stored[0] as number;
                const row1Addr = stored[1] as number;
                const row0 = heap.read(row0Addr);
                const row1 = heap.read(row1Addr);
                expect(row0.isOk()).toBe(true);
                expect(row1.isOk()).toBe(true);
                if (row0.isOk() && row1.isOk()) {
                    const row0Arr = row0.value.value as number[];
                    const row1Arr = row1.value.value as number[];
                    const r0e0 = heap.read(row0Arr[0] as number);
                    const r0e1 = heap.read(row0Arr[1] as number);
                    const r1e0 = heap.read(row1Arr[0] as number);
                    const r1e1 = heap.read(row1Arr[1] as number);
                    expect(r0e0.isOk() && r0e0.value.value).toBe(1);
                    expect(r0e1.isOk() && r0e1.value.value).toBe(2);
                    expect(r1e0.isOk() && r1e0.value.value).toBe(3);
                    expect(r1e1.isOk() && r1e1.value.value).toBe(4);
                }
            }
        });

        test("write deep copies array from heap correctly", () => {
            const arrayType = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] };
            const srcAddr = heap.allocate([10, 20, 30], arrayType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const destAddr = heap.allocate([0, 0, 0], arrayType);
            const writeResult = heap.write(destAddr, srcObj.value.value, arrayType);
            expect(writeResult.isOk()).toBe(true);

            const destObj = heap.read(destAddr);
            expect(destObj.isOk()).toBe(true);
            if (destObj.isOk()) {
                const stored = destObj.value.value as number[];
                const elem0 = heap.read(stored[0] as number);
                const elem1 = heap.read(stored[1] as number);
                const elem2 = heap.read(stored[2] as number);
                expect(elem0.isOk() && elem0.value.value).toBe(10);
                expect(elem1.isOk() && elem1.value.value).toBe(20);
                expect(elem2.isOk() && elem2.value.value).toBe(30);
            }
        });

        test("write deep copy is independent from source", () => {
            const arrayType = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] };
            const srcAddr = heap.allocate([10, 20, 30], arrayType);
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const destAddr = heap.allocate([0, 0, 0], arrayType);
            heap.write(destAddr, srcObj.value.value, arrayType);

            const destRead = heap.read(destAddr);
            expect(destRead.isOk()).toBe(true);
            if (!destRead.isOk()) return;
            const destStored = destRead.value.value as number[];
            const destElem0Addr = destStored[0] as number;
            heap.write(destElem0Addr, 999, PseudocodeType.INTEGER);

            const srcRead = heap.read(srcAddr);
            expect(srcRead.isOk()).toBe(true);
            if (!srcRead.isOk()) return;
            const srcStored = srcRead.value.value as number[];
            const srcElem0Addr = srcStored[0] as number;
            const srcElem0 = heap.read(srcElem0Addr);
            expect(srcElem0.isOk() && srcElem0.value.value).toBe(10);
        });
    });

    describe("readElementAddress / readFieldAddress", () => {
        test("readElementAddress returns address of array element", () => {
            const addr = heap.allocate([10, 20, 30], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] });
            const elemAddrResult = heap.readElementAddress(addr, 2);
            expect(elemAddrResult.isOk()).toBe(true);
            if (elemAddrResult.isOk()) {
                const elemObj = heap.read(elemAddrResult.value);
                expect(elemObj.isOk() && elemObj.value.value).toBe(20);
            }
        });

        test("readElementAddress rejects out-of-bounds index", () => {
            const addr = heap.allocate([10, 20], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 2 }] });
            const result = heap.readElementAddress(addr, 3);
            expect(result.isErr()).toBe(true);
        });

        test("readFieldAddress returns address of record field", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER } };
            const addr = heap.allocate({ name: "Bob", age: 25 }, recordType);
            const fieldAddrResult = heap.readFieldAddress(addr, "age");
            expect(fieldAddrResult.isOk()).toBe(true);
            if (fieldAddrResult.isOk()) {
                const fieldObj = heap.read(fieldAddrResult.value);
                expect(fieldObj.isOk() && fieldObj.value.value).toBe(25);
            }
        });

        test("readFieldAddress rejects unknown field", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING } };
            const addr = heap.allocate({ name: "Bob" }, recordType);
            const result = heap.readFieldAddress(addr, "missing");
            expect(result.isErr()).toBe(true);
        });

        test("readElementAddress rejects index 0", () => {
            const addr = heap.allocate([10], { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 1 }] });
            const result = heap.readElementAddress(addr, 0);
            expect(result.isErr()).toBe(true);
        });
    });
});
