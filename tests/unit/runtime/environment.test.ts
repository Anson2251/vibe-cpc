import { Environment } from "../../../src/runtime/environment";
import { Heap } from "../../../src/runtime/heap";
import { PseudocodeType } from "../../../src/types";

describe("Environment", () => {
    test("supports parent scope lookup and child assignment propagation", () => {
        const heap = new Heap();
        const parent = new Environment(heap);
        parent.define("counter", PseudocodeType.INTEGER, 1);

        const child = parent.createChild();
        expect(child.get("counter")).toBe(1);

        child.assign("counter", 2);
        expect(parent.get("counter")).toBe(2);
    });

    test("throws for duplicate declaration in same scope", () => {
        const heap = new Heap();
        const env = new Environment(heap);
        env.define("name", PseudocodeType.STRING, "A");

        expect(() => env.define("name", PseudocodeType.STRING, "B")).toThrow("already declared");
    });

    test("throws for assigning undefined variable", () => {
        const heap = new Heap();
        const env = new Environment(heap);
        expect(() => env.assign("missing", 1)).toThrow("Undefined variable 'missing'");
    });

    test("enforces constant assignment rule", () => {
        const heap = new Heap();
        const env = new Environment(heap);
        env.define("PI", PseudocodeType.REAL, 3.14, true);

        expect(() => env.assign("PI", 3.14159)).toThrow("Cannot assign to constant");
    });

    test("validates runtime type on assignment", () => {
        const heap = new Heap();
        const env = new Environment(heap);
        env.define("age", PseudocodeType.INTEGER, 18);

        expect(() => env.assign("age", "18")).toThrow("Expected INTEGER");
    });

    describe("define with fromHeap", () => {
        test("defines array from heap-read value with fromHeap=true", () => {
            const heap = new Heap();
            const env = new Environment(heap);
            const arrayType = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] };

            env.define("src", arrayType, [10, 20, 30]);
            const srcValue = env.getAtom("src").getAddress();
            const srcObj = heap.read(srcValue);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const child = env.createChild();
            child.define("copy", arrayType, srcObj.value.value, false, true);

            const copyValue = child.getAtom("copy").getAddress();
            const copyObj = heap.read(copyValue);
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

        test("fromHeap=true produces independent copy of array", () => {
            const heap = new Heap();
            const env = new Environment(heap);
            const arrayType = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 3 }] };

            env.define("src", arrayType, [10, 20, 30]);
            const srcAddr = env.getAtom("src").getAddress();
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const child = env.createChild();
            child.define("copy", arrayType, srcObj.value.value, false, true);

            child.assign("copy", [99, 99, 99]);
            const srcRead = heap.read(srcAddr);
            expect(srcRead.isOk()).toBe(true);
            if (srcRead.isOk()) {
                const stored = srcRead.value.value as number[];
                const elem0 = heap.read(stored[0] as number);
                expect(elem0.isOk() && elem0.value.value).toBe(10);
            }
        });

        test("defines record from heap-read value with fromHeap=true", () => {
            const heap = new Heap();
            const env = new Environment(heap);
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING, age: PseudocodeType.INTEGER } };

            env.define("src", recordType, { name: "Alice", age: 30 });
            const srcAddr = env.getAtom("src").getAddress();
            const srcObj = heap.read(srcAddr);
            expect(srcObj.isOk()).toBe(true);
            if (!srcObj.isOk()) return;

            const child = env.createChild();
            child.define("copy", recordType, srcObj.value.value, false, true);

            const copyAddr = child.getAtom("copy").getAddress();
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
    });
});
