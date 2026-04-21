import { Heap, NULL_POINTER } from "../../../src/runtime/heap";
import { Environment } from "../../../src/runtime/environment";
import { VariableAtom, VariableAtomFactory } from "../../../src/runtime/variable-atoms";
import { PseudocodeType } from "../../../src/types";
import { RuntimeError, IndexError } from "../../../src/errors";
import { computeArrayAddress, resolveIndices } from "../../../src/runtime/array-helpers";
import type { ArrayTypeInfo } from "../../../src/types";
import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

describe("Error Location Tracking", () => {
    describe("Heap error location", () => {
        let heap: Heap;

        beforeEach(() => {
            heap = new Heap();
        });

        test("read throws RuntimeError with line and column for null pointer", () => {
            expect(() => heap.read(NULL_POINTER, 10, 5)).toThrow(RuntimeError);
            try {
                heap.read(NULL_POINTER, 10, 5);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(10);
                    expect(error.column).toBe(5);
                    expect(error.message).toBe("Null pointer dereference");
                }
            }
        });

        test("read throws RuntimeError with line and column for invalid address", () => {
            expect(() => heap.read(9999, 20, 8)).toThrow(RuntimeError);
            try {
                heap.read(9999, 20, 8);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(8);
                    expect(error.message).toContain("Invalid memory address");
                }
            }
        });

        test("write throws RuntimeError with line and column for null pointer", () => {
            expect(() => heap.write(NULL_POINTER, 42, PseudocodeType.INTEGER, 15, 3)).toThrow(RuntimeError);
            try {
                heap.write(NULL_POINTER, 42, PseudocodeType.INTEGER, 15, 3);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(15);
                    expect(error.column).toBe(3);
                    expect(error.message).toBe("Cannot write to null pointer");
                }
            }
        });

        test("write throws RuntimeError with line and column for invalid address", () => {
            expect(() => heap.write(9999, 42, PseudocodeType.INTEGER, 25, 12)).toThrow(RuntimeError);
            try {
                heap.write(9999, 42, PseudocodeType.INTEGER, 25, 12);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(25);
                    expect(error.column).toBe(12);
                    expect(error.message).toContain("Invalid memory address");
                }
            }
        });

        test("write throws RuntimeError with line and column for immutable write", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            expect(() => heap.write(addr, 100, PseudocodeType.INTEGER, 30, 7)).toThrow(RuntimeError);
            try {
                heap.write(addr, 100, PseudocodeType.INTEGER, 30, 7);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(30);
                    expect(error.column).toBe(7);
                    expect(error.message).toBe("Cannot modify constant");
                }
            }
        });

        test("writeCOW throws RuntimeError with line and column for null pointer", () => {
            expect(() => heap.writeCOW(NULL_POINTER, 42, PseudocodeType.INTEGER, 35, 9)).toThrow(RuntimeError);
            try {
                heap.writeCOW(NULL_POINTER, 42, PseudocodeType.INTEGER, 35, 9);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(35);
                    expect(error.column).toBe(9);
                    expect(error.message).toBe("Cannot write to null pointer");
                }
            }
        });

        test("writeCOW throws RuntimeError with line and column for invalid address", () => {
            expect(() => heap.writeCOW(9999, 42, PseudocodeType.INTEGER, 40, 11)).toThrow(RuntimeError);
            try {
                heap.writeCOW(9999, 42, PseudocodeType.INTEGER, 40, 11);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(40);
                    expect(error.column).toBe(11);
                    expect(error.message).toContain("Invalid memory address");
                }
            }
        });

        test("writeCOW throws RuntimeError with line and column for immutable write", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            expect(() => heap.writeCOW(addr, 100, PseudocodeType.INTEGER, 45, 13)).toThrow(RuntimeError);
            try {
                heap.writeCOW(addr, 100, PseudocodeType.INTEGER, 45, 13);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(45);
                    expect(error.column).toBe(13);
                    expect(error.message).toBe("Cannot modify constant");
                }
            }
        });

        test("deallocate throws RuntimeError with line and column for invalid address", () => {
            expect(() => heap.deallocate(9999, 50, 15)).toThrow(RuntimeError);
            try {
                heap.deallocate(9999, 50, 15);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(50);
                    expect(error.column).toBe(15);
                    expect(error.message).toContain("Invalid memory address");
                }
            }
        });

        test("decrementRef throws RuntimeError with line and column for invalid address", () => {
            expect(() => heap.decrementRef(9999, 55, 17)).toThrow(RuntimeError);
            try {
                heap.decrementRef(9999, 55, 17);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(55);
                    expect(error.column).toBe(17);
                    expect(error.message).toContain("Invalid memory address");
                }
            }
        });

        test("readElementAddress throws RuntimeError with line and column for out of bounds", () => {
            const addr = heap.allocate([10, 20], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 2 }],
            });
            expect(() => heap.readElementAddress(addr, 5, 40, 15)).toThrow(RuntimeError);
            try {
                heap.readElementAddress(addr, 5, 40, 15);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(40);
                    expect(error.column).toBe(15);
                    expect(error.message).toContain("Array index out of bounds");
                }
            }
        });

        test("readElementAddress throws RuntimeError with line and column for non-array value", () => {
            const recordType = {
                name: "Person",
                fields: { name: PseudocodeType.STRING },
            };
            const addr = heap.allocate({ name: "Bob" }, recordType);
            expect(() => heap.readElementAddress(addr, 1, 60, 20)).toThrow(RuntimeError);
            try {
                heap.readElementAddress(addr, 1, 60, 20);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(60);
                    expect(error.column).toBe(20);
                    expect(error.message).toBe("Array access on non-array value");
                }
            }
        });

        test("readFieldAddress throws RuntimeError with line and column for unknown field", () => {
            const recordType = {
                name: "Person",
                fields: { name: PseudocodeType.STRING },
            };
            const addr = heap.allocate({ name: "Bob" }, recordType);
            expect(() => heap.readFieldAddress(addr, "missing", 50, 20)).toThrow(RuntimeError);
            try {
                heap.readFieldAddress(addr, "missing", 50, 20);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(50);
                    expect(error.column).toBe(20);
                    expect(error.message).toContain("Invalid field address");
                }
            }
        });

        test("readFieldAddress throws RuntimeError with line and column for non-record value", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(() => heap.readFieldAddress(addr, "field", 65, 22)).toThrow(RuntimeError);
            try {
                heap.readFieldAddress(addr, "field", 65, 22);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(65);
                    expect(error.column).toBe(22);
                    expect(error.message).toBe("Record access on non-record value");
                }
            }
        });
    });

    describe("Environment error location", () => {
        let heap: Heap;
        let env: Environment;

        beforeEach(() => {
            heap = new Heap();
            env = new Environment(heap);
        });

        test("define throws RuntimeError with line and column for duplicate variable", () => {
            env.define("x", PseudocodeType.INTEGER, 42);
            expect(() => env.define("x", PseudocodeType.INTEGER, 100, false, false, 10, 5)).toThrow(RuntimeError);
            try {
                env.define("x", PseudocodeType.INTEGER, 100, false, false, 10, 5);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(10);
                    expect(error.column).toBe(5);
                    expect(error.message).toContain("already declared");
                }
            }
        });

        test("defineByRef throws RuntimeError with line and column for duplicate variable", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            env.defineByRef("x", PseudocodeType.INTEGER, addr);
            expect(() => env.defineByRef("x", PseudocodeType.INTEGER, addr, 15, 7)).toThrow(RuntimeError);
            try {
                env.defineByRef("x", PseudocodeType.INTEGER, addr, 15, 7);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(15);
                    expect(error.column).toBe(7);
                    expect(error.message).toContain("already declared");
                }
            }
        });

        test("defineByValCOW throws RuntimeError with line and column for duplicate variable", () => {
            env.defineByValCOW("x", PseudocodeType.INTEGER, 42);
            expect(() => env.defineByValCOW("x", PseudocodeType.INTEGER, 100, 20, 9)).toThrow(RuntimeError);
            try {
                env.defineByValCOW("x", PseudocodeType.INTEGER, 100, 20, 9);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(9);
                    expect(error.message).toContain("already declared");
                }
            }
        });

        test("get throws RuntimeError with line and column for undefined variable", () => {
            expect(() => env.get("undefinedVar", 20, 8)).toThrow(RuntimeError);
            try {
                env.get("undefinedVar", 20, 8);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(8);
                    expect(error.message).toContain("Undefined variable");
                }
            }
        });

        test("getAtom throws RuntimeError with line and column for undefined variable", () => {
            expect(() => env.getAtom("undefinedVar", 25, 10)).toThrow(RuntimeError);
            try {
                env.getAtom("undefinedVar", 25, 10);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(25);
                    expect(error.column).toBe(10);
                    expect(error.message).toContain("Undefined variable");
                }
            }
        });

        test("getType throws RuntimeError with line and column for undefined variable", () => {
            expect(() => env.getType("undefinedVar", 30, 12)).toThrow(RuntimeError);
            try {
                env.getType("undefinedVar", 30, 12);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(30);
                    expect(error.column).toBe(12);
                    expect(error.message).toContain("Undefined variable");
                }
            }
        });

        test("assign throws RuntimeError with line and column for undefined variable", () => {
            expect(() => env.assign("undefinedVar", 42, 30, 12)).toThrow(RuntimeError);
            try {
                env.assign("undefinedVar", 42, 30, 12);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(30);
                    expect(error.column).toBe(12);
                    expect(error.message).toContain("Undefined variable");
                }
            }
        });

        test("assign throws RuntimeError with line and column for constant", () => {
            env.define("constVar", PseudocodeType.INTEGER, 42, true);
            expect(() => env.assign("constVar", 100, 35, 14)).toThrow(RuntimeError);
            try {
                env.assign("constVar", 100, 35, 14);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(35);
                    expect(error.column).toBe(14);
                    expect(error.message).toContain("Cannot assign to constant");
                }
            }
        });

        test("assignPointer throws RuntimeError with line and column for constant", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            env.define("constPtr", PseudocodeType.INTEGER, addr, true);
            const newAddr = heap.allocate(100, PseudocodeType.INTEGER);
            expect(() => env.assignPointer("constPtr", newAddr, 40, 16)).toThrow(RuntimeError);
            try {
                env.assignPointer("constPtr", newAddr, 40, 16);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(40);
                    expect(error.column).toBe(16);
                    expect(error.message).toContain("Cannot assign to constant");
                }
            }
        });

        test("assignPointer throws RuntimeError with line and column for undefined variable", () => {
            const addr = heap.allocate(42, PseudocodeType.INTEGER);
            expect(() => env.assignPointer("undefinedPtr", addr, 45, 18)).toThrow(RuntimeError);
            try {
                env.assignPointer("undefinedPtr", addr, 45, 18);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(45);
                    expect(error.column).toBe(18);
                    expect(error.message).toContain("Undefined variable");
                }
            }
        });

        test("defineRoutine throws RuntimeError with line and column for duplicate routine", () => {
            const signature = {
                name: "testRoutine",
                parameters: [],
                returnType: PseudocodeType.INTEGER,
                body: [],
            };
            env.defineRoutine(signature);
            expect(() => env.defineRoutine(signature, 50, 20)).toThrow(RuntimeError);
            try {
                env.defineRoutine(signature, 50, 20);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(50);
                    expect(error.column).toBe(20);
                    expect(error.message).toContain("already declared");
                }
            }
        });

        test("getRoutine throws RuntimeError with line and column for undefined routine", () => {
            expect(() => env.getRoutine("undefinedRoutine", 55, 22)).toThrow(RuntimeError);
            try {
                env.getRoutine("undefinedRoutine", 55, 22);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(55);
                    expect(error.column).toBe(22);
                    expect(error.message).toContain("Undefined routine");
                }
            }
        });

        test("getFileHandle throws RuntimeError with line and column for undefined handle", () => {
            expect(() => env.getFileHandle("undefinedHandle", 60, 24)).toThrow(RuntimeError);
            try {
                env.getFileHandle("undefinedHandle", 60, 24);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(60);
                    expect(error.column).toBe(24);
                    expect(error.message).toContain("Undefined file handle");
                }
            }
        });

        test("releaseFileHandle throws RuntimeError with line and column for undefined handle", () => {
            expect(() => env.releaseFileHandle("undefinedHandle", 65, 26)).toThrow(RuntimeError);
            try {
                env.releaseFileHandle("undefinedHandle", 65, 26);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(65);
                    expect(error.column).toBe(26);
                    expect(error.message).toContain("Undefined file handle");
                }
            }
        });
    });

    describe("VariableAtom error location", () => {
        let heap: Heap;
        let atom: VariableAtom;

        beforeEach(() => {
            heap = new Heap();
            const addr = heap.allocate(42, PseudocodeType.INTEGER, false);
            atom = new VariableAtom(addr, PseudocodeType.INTEGER, true);
        });

        test("setValue throws RuntimeError with line and column for constant", () => {
            expect(() => atom.setValue(heap, 100, 10, 5)).toThrow(RuntimeError);
            try {
                atom.setValue(heap, 100, 10, 5);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(10);
                    expect(error.column).toBe(5);
                    expect(error.message).toBe("Cannot assign to constant");
                }
            }
        });

        test("setValueCOW throws RuntimeError with line and column for constant", () => {
            expect(() => atom.setValueCOW(heap, 100, 20, 8)).toThrow(RuntimeError);
            try {
                atom.setValueCOW(heap, 100, 20, 8);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(8);
                    expect(error.message).toBe("Cannot assign to constant");
                }
            }
        });
    });

    describe("VariableAtomFactory validateValue error location", () => {
        test("validateValue throws RuntimeError with line and column for INTEGER type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.INTEGER, "not a number", 10, 5)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.INTEGER, "not a number", 10, 5);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(10);
                    expect(error.column).toBe(5);
                    expect(error.message).toContain("Expected INTEGER");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for REAL type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.REAL, "not a number", 15, 7)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.REAL, "not a number", 15, 7);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(15);
                    expect(error.column).toBe(7);
                    expect(error.message).toContain("Expected REAL");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for CHAR type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.CHAR, "too long", 20, 9)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.CHAR, "too long", 20, 9);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(9);
                    expect(error.message).toContain("Expected CHAR");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for STRING type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.STRING, 42, 25, 11)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.STRING, 42, 25, 11);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(25);
                    expect(error.column).toBe(11);
                    expect(error.message).toContain("Expected STRING");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for BOOLEAN type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.BOOLEAN, "not boolean", 30, 13)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.BOOLEAN, "not boolean", 30, 13);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(30);
                    expect(error.column).toBe(13);
                    expect(error.message).toContain("Expected BOOLEAN");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for DATE type mismatch", () => {
            expect(() => VariableAtomFactory.validateValue(PseudocodeType.DATE, "not a date", 35, 15)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(PseudocodeType.DATE, "not a date", 35, 15);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(35);
                    expect(error.column).toBe(15);
                    expect(error.message).toContain("Expected DATE");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for ENUM type mismatch", () => {
            const enumType = { kind: "ENUM" as const, name: "Color", values: ["RED", "GREEN", "BLUE"] };
            expect(() => VariableAtomFactory.validateValue(enumType, "YELLOW", 40, 17)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(enumType, "YELLOW", 40, 17);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(40);
                    expect(error.column).toBe(17);
                    expect(error.message).toContain("Expected enum");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for SET type mismatch", () => {
            const setType: import("../../../src/types").SetTypeInfo = { kind: "SET", name: "NumberSet", elementType: PseudocodeType.INTEGER };
            expect(() => VariableAtomFactory.validateValue(setType, [1, 2, 3], 45, 19)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(setType, [1, 2, 3], 45, 19);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(45);
                    expect(error.column).toBe(19);
                    expect(error.message).toContain("Expected SET");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for POINTER type mismatch", () => {
            const pointerType: import("../../../src/types").PointerTypeInfo = { kind: "POINTER", name: "IntPointer", pointedType: PseudocodeType.INTEGER };
            expect(() => VariableAtomFactory.validateValue(pointerType, "not a pointer", 50, 21)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(pointerType, "not a pointer", 50, 21);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(50);
                    expect(error.column).toBe(21);
                    expect(error.message).toContain("Expected POINTER");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for CLASS type mismatch", () => {
            const classType: import("../../../src/types").ClassTypeInfo = { kind: "CLASS", name: "Person", fields: { name: PseudocodeType.STRING }, fieldVisibility: { name: "PUBLIC" }, methods: {} };
            expect(() => VariableAtomFactory.validateValue(classType, "not a class", 55, 23)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(classType, "not a class", 55, 23);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(55);
                    expect(error.column).toBe(23);
                    expect(error.message).toContain("Expected class");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for ARRAY type mismatch", () => {
            const arrayType: import("../../../src/types").ArrayTypeInfo = { elementType: PseudocodeType.INTEGER, bounds: [{ lower: 1, upper: 10 }] };
            expect(() => VariableAtomFactory.validateValue(arrayType, "not an array", 60, 25)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(arrayType, "not an array", 60, 25);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(60);
                    expect(error.column).toBe(25);
                    expect(error.message).toContain("Expected ARRAY");
                }
            }
        });

        test("validateValue throws RuntimeError with line and column for RECORD type mismatch", () => {
            const recordType = { name: "Person", fields: { name: PseudocodeType.STRING } };
            expect(() => VariableAtomFactory.validateValue(recordType, "not a record", 65, 27)).toThrow(RuntimeError);
            try {
                VariableAtomFactory.validateValue(recordType, "not a record", 65, 27);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(65);
                    expect(error.column).toBe(27);
                    expect(error.message).toContain("Expected user-defined type");
                }
            }
        });
    });

    describe("Array helpers error location", () => {
        let heap: Heap;

        beforeEach(() => {
            heap = new Heap();
        });

        test("computeArrayAddress throws RuntimeError with line and column for dimension mismatch", () => {
            const addr = heap.allocate([10], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 1 }],
            });
            const arrayType: ArrayTypeInfo = {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 1 }, { lower: 1, upper: 1 }],
            };
            expect(() => computeArrayAddress(addr, arrayType, [1, 1], heap, 10, 5)).toThrow(RuntimeError);
            try {
                computeArrayAddress(addr, arrayType, [1, 1], heap, 10, 5);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(10);
                    expect(error.column).toBe(5);
                }
            }
        });

        test("computeArrayAddress throws RuntimeError with line and column for out of bounds", () => {
            const addr = heap.allocate([10, 20], {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 2 }],
            });
            const arrayType: ArrayTypeInfo = {
                elementType: PseudocodeType.INTEGER,
                bounds: [{ lower: 1, upper: 2 }],
            };
            expect(() => computeArrayAddress(addr, arrayType, [5], heap, 15, 7)).toThrow(RuntimeError);
            try {
                computeArrayAddress(addr, arrayType, [5], heap, 15, 7);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(15);
                    expect(error.column).toBe(7);
                    expect(error.message).toContain("Array index out of bounds");
                }
            }
        });

        test("resolveIndices throws IndexError with line and column for non-integer", () => {
            expect(() => resolveIndices([1.5], 20, 9)).toThrow(IndexError);
            try {
                resolveIndices([1.5], 20, 9);
            } catch (error) {
                if (error instanceof IndexError) {
                    expect(error.line).toBe(20);
                    expect(error.column).toBe(9);
                    expect(error.message).toBe("Array index must be INTEGER");
                }
            }
        });

        test("resolveIndices throws RuntimeError with line and column for non-numeric value", () => {
            expect(() => resolveIndices(["not a number"], 25, 11)).toThrow(RuntimeError);
            try {
                resolveIndices(["not a number"], 25, 11);
            } catch (error) {
                if (error instanceof RuntimeError) {
                    expect(error.line).toBe(25);
                    expect(error.column).toBe(11);
                    expect(error.message).toBe("Expected numeric value");
                }
            }
        });
    });

    describe("Builtin functions error location", () => {
        test("STR_TO_NUM throws RuntimeError with line and column for empty string", async () => {
            const io = new MockIO();
            const interpreter = new Interpreter(io);

            const result = await interpreter.execute(`OUTPUT STR_TO_NUM("")`);
            expect(result.success).toBe(false);
            const error = (result as any).error;
            expect(error).toBeInstanceOf(RuntimeError);
            expect(error.line).toBe(1);
            expect(error.column).toBeDefined();
            expect(error.message).toContain("STR_TO_NUM");
        });

        test("STR_TO_NUM throws RuntimeError with line and column for invalid string", async () => {
            const io = new MockIO();
            const interpreter = new Interpreter(io);

            const result = await interpreter.execute(`OUTPUT STR_TO_NUM("abc")`);
            expect(result.success).toBe(false);
            const error = (result as any).error;
            expect(error).toBeInstanceOf(RuntimeError);
            expect(error.line).toBe(1);
            expect(error.column).toBeDefined();
            expect(error.message).toContain("STR_TO_NUM");
        });

        test("CHR throws RuntimeError with line and column for invalid argument", async () => {
            const io = new MockIO();
            const interpreter = new Interpreter(io);

            const result = await interpreter.execute(`OUTPUT CHR(200)`);
            expect(result.success).toBe(false);
            const error = (result as any).error;
            expect(error).toBeInstanceOf(RuntimeError);
            expect(error.line).toBe(1);
            expect(error.column).toBeDefined();
            expect(error.message).toContain("CHR");
        });

        test("RAND throws RuntimeError with line and column for invalid argument", async () => {
            const io = new MockIO();
            const interpreter = new Interpreter(io);

            const result = await interpreter.execute(`OUTPUT RAND(0)`);
            expect(result.success).toBe(false);
            const error = (result as any).error;
            expect(error).toBeInstanceOf(RuntimeError);
            expect(error.line).toBe(1);
            expect(error.column).toBeDefined();
            expect(error.message).toContain("RAND");
        });

        test("SQRT throws RuntimeError with line and column for negative value", async () => {
            const io = new MockIO();
            const interpreter = new Interpreter(io);

            const result = await interpreter.execute(`OUTPUT SQRT(-1)`);
            expect(result.success).toBe(false);
            const error = (result as any).error;
            expect(error).toBeInstanceOf(RuntimeError);
            expect(error.line).toBe(1);
            expect(error.column).toBeDefined();
            expect(error.message).toContain("SQRT");
        });
    });
});
