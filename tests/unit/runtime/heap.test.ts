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
            const addr = heap.allocate(arr, {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            arr[0] = 999;
            const obj = heap.read(addr);
            const stored = obj.value as number[];
            expect(stored.length).toBe(3);
            const elemAddr = stored[0];
            const elemObj = heap.read(elemAddr as number);
            expect(elemObj.value).toBe(1);
        });

        test("allocates with default mutability", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const obj = heap.read(addr);
            expect(obj.isMutable).toBe(true);
        });

        test("allocates with explicit immutability", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            const obj = heap.read(addr);
            expect(obj.isMutable).toBe(false);
        });
    });

    describe("read", () => {
        test("reads allocated value", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            const result = heap.read(addr);
            expect(result.value).toBe(42);
            expect(result.type).toBe(PseudocodeType.INTEGER);
            expect(result.refCount).toBe(1);
        });

        test("throws for null pointer read", () => {
            expect(() => heap.read(NULL_POINTER)).toThrow(RuntimeError);
        });

        test("throws for invalid address", () => {
            expect(() => heap.read(9999)).toThrow(RuntimeError);
        });
    });

    describe("write", () => {
        test("writes value to allocated address", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.write(addr, 100, PseudocodeType.INTEGER);

            const readResult = heap.read(addr);
            expect(readResult.value).toBe(100);
        });

        test("throws for null pointer write", () => {
            expect(() => heap.write(NULL_POINTER, 42, PseudocodeType.INTEGER)).toThrow(
                RuntimeError,
            );
        });

        test("throws for invalid address write", () => {
            expect(() => heap.write(9999, 42, PseudocodeType.INTEGER)).toThrow(RuntimeError);
        });

        test("throws for immutable write", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            expect(() => heap.write(addr, 100, PseudocodeType.INTEGER)).toThrow(RuntimeError);
        });

        test("deep copies on write", () => {
            const addr = heap.allocate([1, 2, 3], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            const newArr = [10, 20, 30];
            heap.write(addr, newArr, {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            newArr[0] = 999;

            const result = heap.read(addr);
            const stored = result.value as number[];
            const elemAddr = stored[0];
            const elemObj = heap.read(elemAddr as number);
            expect(elemObj.value).toBe(10);
        });
    });

    describe("deallocate", () => {
        test("decrements refCount on deallocate", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            const obj1 = heap.read(addr);
            expect(obj1.refCount).toBe(2);

            heap.deallocate(addr);
            const obj2 = heap.read(addr);
            expect(obj2.refCount).toBe(1);
        });

        test("frees memory when refCount reaches zero", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(heap.getAllocatedCount()).toBe(1);

            heap.deallocate(addr);
            expect(heap.getAllocatedCount()).toBe(0);

            expect(() => heap.read(addr)).toThrow(RuntimeError);
        });

        test("reuses freed addresses", () => {
            const addr1 = heap.allocate(1, PseudocodeType.INTEGER);
            heap.deallocate(addr1);
            const addr2 = heap.allocate(2, PseudocodeType.INTEGER);
            expect(addr2).toBe(addr1);
        });

        test("no-op for null pointer deallocate", () => {
            expect(() => heap.deallocate(NULL_POINTER)).not.toThrow();
        });

        test("throws for invalid address deallocate", () => {
            expect(() => heap.deallocate(9999)).toThrow(RuntimeError);
        });
    });

    describe("reference counting", () => {
        test("incrementRef increases refCount", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            const obj = heap.read(addr);
            expect(obj.refCount).toBe(2);
        });

        test("decrementRef decreases refCount", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.incrementRef(addr);
            heap.decrementRef(addr);
            const obj = heap.read(addr);
            expect(obj.refCount).toBe(1);
        });

        test("decrementRef frees memory when refCount reaches zero", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            heap.decrementRef(addr);
            expect(heap.getAllocatedCount()).toBe(0);
        });

        test("incrementRef on null pointer is no-op", () => {
            expect(() => heap.incrementRef(NULL_POINTER)).not.toThrow();
        });

        test("decrementRef on null pointer is no-op", () => {
            expect(() => heap.decrementRef(NULL_POINTER)).not.toThrow();
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
            const addr = heap.allocate(arr, {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            const obj = heap.read(addr);
            const stored = obj.value as number[];
            expect(stored.length).toBe(3);
            expect(stored).not.toBe(arr);
            const elem0 = heap.read(stored[0] as number);
            const elem1 = heap.read(stored[1] as number);
            const elem2 = heap.read(stored[2] as number);
            expect(elem0.value).toBe(1);
            expect(elem1.value).toBe(2);
            expect(elem2.value).toBe(3);
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
            const stored = obj.value as Record<string, unknown>;
            expect(stored).not.toBe(record);
            const nameAddr = stored.name as number;
            const ageAddr = stored.age as number;
            const nameObj = heap.read(nameAddr);
            const ageObj = heap.read(ageAddr);
            expect(nameObj.value).toBe("Alice");
            expect(ageObj.value).toBe(30);
        });

        test("deep copies sets", () => {
            const set = new Set([1, 2, 3]);
            const addr = heap.allocate(set, {
                kind: "SET",
                name: "IntSet",
                elementType: PseudocodeType.INTEGER,
            });
            const obj = heap.read(addr);
            const stored = obj.value as Set<number>;
            expect(stored.has(1)).toBe(true);
            expect(stored.has(2)).toBe(true);
            expect(stored.has(3)).toBe(true);
            expect(stored).not.toBe(set);
        });

        test("does not deep copy pointer values", () => {
            const ptrValue = 42;
            const addr = heap.allocate(ptrValue, {
                kind: "POINTER",
                name: "^INTEGER",
                pointedType: PseudocodeType.INTEGER,
            });
            const obj = heap.read(addr);
            expect(obj.value).toBe(42);
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
            const addr = heap.allocate([1, 2, 3], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
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
            const addr = heap.allocate(
                [10, 20, 30],
                { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] },
                true,
                false,
            );
            const obj = heap.read(addr);
            const stored = obj.value as number[];
            const elem0 = heap.read(stored[0] as number);
            const elem1 = heap.read(stored[1] as number);
            const elem2 = heap.read(stored[2] as number);
            expect(elem0.value).toBe(10);
            expect(elem1.value).toBe(20);
            expect(elem2.value).toBe(30);
        });

        test("deep copies array elements as addresses with fromHeap", () => {
            const srcAddr = heap.allocate([10, 20, 30], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            const srcObj = heap.read(srcAddr);
            const srcValue = srcObj.value;

            const copyAddr = heap.allocate(
                srcValue,
                { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] },
                true,
                true,
            );
            const copyObj = heap.read(copyAddr);
            const stored = copyObj.value as number[];
            const elem0 = heap.read(stored[0] as number);
            const elem1 = heap.read(stored[1] as number);
            const elem2 = heap.read(stored[2] as number);
            expect(elem0.value).toBe(10);
            expect(elem1.value).toBe(20);
            expect(elem2.value).toBe(30);
        });

        test("fromHeap deep copy produces independent copies", () => {
            const srcAddr = heap.allocate([10, 20, 30], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            const srcObj = heap.read(srcAddr);
            const srcValue = srcObj.value;

            const copyAddr = heap.allocate(
                srcValue,
                { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] },
                true,
                true,
            );

            const copyStored = heap.read(copyAddr).value as number[];
            const copyElem0Addr = copyStored[0] as number;
            heap.write(copyElem0Addr, 999, PseudocodeType.INTEGER);

            const srcStored = heap.read(srcAddr).value as number[];
            const srcElem0Addr = srcStored[0] as number;
            const srcElem0 = heap.read(srcElem0Addr);
            expect(srcElem0.value).toBe(10);
        });

        test("deep copies record fields as addresses with fromHeap", () => {
            const recordType = {
                name: "Person",
                fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER },
            };
            const srcAddr = heap.allocate({ name: "Alice", age: 30 }, recordType);
            const srcObj = heap.read(srcAddr);
            const srcValue = srcObj.value;

            const copyAddr = heap.allocate(srcValue, recordType, true, true);
            const copyObj = heap.read(copyAddr);
            const stored = copyObj.value as Record<string, unknown>;
            const nameAddr = stored.name as number;
            const ageAddr = stored.age as number;
            const nameObj = heap.read(nameAddr);
            const ageObj = heap.read(ageAddr);
            expect(nameObj.value).toBe("Alice");
            expect(ageObj.value).toBe(30);
        });

        test("fromHeap record deep copy produces independent copies", () => {
            const recordType = {
                name: "Person",
                fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER },
            };
            const srcAddr = heap.allocate({ name: "Alice", age: 30 }, recordType);
            const srcObj = heap.read(srcAddr);
            const srcValue = srcObj.value;

            const copyAddr = heap.allocate(srcValue, recordType, true, true);

            const copyStored = heap.read(copyAddr).value as Record<string, unknown>;
            const copyAgeAddr = copyStored.age as number;
            heap.write(copyAgeAddr, 99, PseudocodeType.INTEGER);

            const srcStored = heap.read(srcAddr).value as Record<string, unknown>;
            const srcAgeAddr = srcStored.age as number;
            const srcAgeObj = heap.read(srcAgeAddr);
            expect(srcAgeObj.value).toBe(30);
        });

        test("write deep copy is independent from source", () => {
            const arrayType = {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            };
            const srcAddr = heap.allocate([10, 20, 30], arrayType);
            const srcObj = heap.read(srcAddr);
            const srcValue = srcObj.value;

            const destAddr = heap.allocate([0, 0, 0], arrayType);
            heap.write(destAddr, srcValue, arrayType);

            const destStored = heap.read(destAddr).value as number[];
            const destElem0Addr = destStored[0] as number;
            heap.write(destElem0Addr, 999, PseudocodeType.INTEGER);

            const srcStored = heap.read(srcAddr).value as number[];
            const srcElem0Addr = srcStored[0] as number;
            const srcElem0 = heap.read(srcElem0Addr);
            expect(srcElem0.value).toBe(10);
        });
    });

    describe("readElementAddress / readFieldAddress", () => {
        test("readElementAddress returns address of array element", () => {
            const addr = heap.allocate([10, 20, 30], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 3 }],
            });
            const elemAddr = heap.readElementAddress(addr, 2);
            const elemObj = heap.read(elemAddr);
            expect(elemObj.value).toBe(20);
        });

        test("readElementAddress rejects out-of-bounds index", () => {
            const addr = heap.allocate([10, 20], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 2 }],
            });
            expect(() => heap.readElementAddress(addr, 3)).toThrow(RuntimeError);
        });

        test("readFieldAddress returns address of record field", () => {
            const recordType = {
                name: "Person",
                fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER },
            };
            const addr = heap.allocate({ name: "Bob", age: 25 }, recordType);
            const fieldAddr = heap.readFieldAddress(addr, "age");
            const fieldObj = heap.read(fieldAddr);
            expect(fieldObj.value).toBe(25);
        });

        test("readFieldAddress rejects unknown field", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING } };
            const addr = heap.allocate({ name: "Bob" }, recordType);
            expect(() => heap.readFieldAddress(addr, "missing")).toThrow(RuntimeError);
        });

        test("readElementAddress rejects index 0", () => {
            const addr = heap.allocate([10], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 1 }],
            });
            expect(() => heap.readElementAddress(addr, 0)).toThrow(RuntimeError);
        });
    });
});
