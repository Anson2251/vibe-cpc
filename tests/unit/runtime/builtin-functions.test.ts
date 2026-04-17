import builtInFunctions from "../../../src/runtime/builtin-functions";
import { PseudocodeType, TypeValidator } from "../../../src/types";

describe("builtInFunctions", () => {
    test("STR_TO_NUM trims whitespace and parses signed decimals", () => {
        const fn = builtInFunctions.STR_TO_NUM.implementation;
        expect(fn).toBeDefined();

        expect(fn!("  -12.50  ")).toBe(-12.5);
        expect(fn!("+8")).toBe(8);
    });

    test("STR_TO_NUM rejects empty and invalid numeric strings", () => {
        const fn = builtInFunctions.STR_TO_NUM.implementation;
        expect(fn).toBeDefined();

        expect(() => fn!("   ")).toThrow("non-empty numeric string");
        expect(() => fn!("12abc")).toThrow("valid numeric string");
    });

    test("RAND rejects non-positive limits", () => {
        const fn = builtInFunctions.RAND.implementation;
        expect(fn).toBeDefined();

        expect(() => fn!(0)).toThrow("greater than 0");
        expect(() => fn!(-5)).toThrow("greater than 0");
    });

    test("LEFT and RIGHT handle oversize length consistently", () => {
        const left = builtInFunctions.LEFT.implementation;
        const right = builtInFunctions.RIGHT.implementation;
        expect(left).toBeDefined();
        expect(right).toBeDefined();

        expect(left!("abc", 10)).toBe("abc");
        expect(right!("abc", 10)).toBe("abc");
    });

    test("MID honors start index and length boundaries", () => {
        const fn = builtInFunctions.MID.implementation;
        expect(fn).toBeDefined();

        expect(fn!("abcdef", 2, 3)).toBe("bcd");
        expect(fn!("abcdef", 5, 10)).toBe("ef");
    });

    test("MID uses 1-based indexing per CAIE spec", () => {
        const fn = builtInFunctions.MID.implementation;
        expect(fn).toBeDefined();

        expect(fn!("ABCDEFGH", 2, 3)).toBe("BCD");
        expect(fn!("ABCDEFGH", 1, 1)).toBe("A");
        expect(fn!("ABCDEFGH", 8, 1)).toBe("H");
        expect(fn!("ABCDEFGH", 1, 8)).toBe("ABCDEFGH");
    });

    test("MID handles edge cases", () => {
        const fn = builtInFunctions.MID.implementation;
        expect(fn).toBeDefined();

        expect(fn!("abc", 1, 0)).toBe("");
        expect(fn!("abc", 4, 1)).toBe("");
        expect(fn!("abc", 3, 10)).toBe("c");
    });

    test("POSITION returns 1-based index or 0 if not found", () => {
        const fn = builtInFunctions.POSITION.implementation;
        expect(fn).toBeDefined();

        expect(fn!("Hello World", "World")).toBe(7);
        expect(fn!("Hello World", "Hello")).toBe(1);
        expect(fn!("abcdef", "def")).toBe(4);
        expect(fn!("abcdef", "xyz")).toBe(0);
        expect(fn!("abcabc", "abc")).toBe(1);
    });

    test("POSITION handles empty substring", () => {
        const fn = builtInFunctions.POSITION.implementation;
        expect(fn).toBeDefined();

        expect(fn!("abc", "")).toBe(1);
    });

    test("ROUND rounds to specified decimal places", () => {
        const fn = builtInFunctions.ROUND.implementation;
        expect(fn).toBeDefined();

        expect(fn!(3.14159, 2)).toBe(3.14);
        expect(fn!(2.5, 0)).toBe(3);
        expect(fn!(2.4, 0)).toBe(2);
        expect(fn!(123.456, 1)).toBe(123.5);
        expect(fn!(1.5, 0)).toBe(2);
        expect(fn!(1.55, 1)).toBe(1.6);
    });

    test("ABS returns absolute value", () => {
        const fn = builtInFunctions.ABS.implementation;
        expect(fn).toBeDefined();

        expect(fn!(-4.7)).toBe(4.7);
        expect(fn!(3)).toBe(3);
        expect(fn!(0)).toBe(0);
        expect(fn!(-0)).toBe(0);
    });

    test("SQRT returns square root and rejects negatives", () => {
        const fn = builtInFunctions.SQRT.implementation;
        expect(fn).toBeDefined();

        expect(fn!(25)).toBe(5);
        expect(fn!(2)).toBeCloseTo(Math.SQRT2);
        expect(fn!(0)).toBe(0);
        expect(() => fn!(-1)).toThrow("non-negative");
    });

    test("REPLACE replaces all occurrences", () => {
        const fn = builtInFunctions.REPLACE.implementation;
        expect(fn).toBeDefined();

        expect(fn!("aabbcc", "b", "X")).toBe("aaXXcc");
        expect(fn!("hello world", "world", "there")).toBe("hello there");
        expect(fn!("aaa", "a", "bb")).toBe("bbbbbb");
        expect(fn!("abc", "x", "y")).toBe("abc");
    });

    test("TRIM removes leading and trailing whitespace", () => {
        const fn = builtInFunctions.TRIM.implementation;
        expect(fn).toBeDefined();

        expect(fn!("  hello  ")).toBe("hello");
        expect(fn!("hello")).toBe("hello");
        expect(fn!("   ")).toBe("");
        expect(fn!("\t\nhello\n\t")).toBe("hello");
    });

    test("POWER raises x to the power n", () => {
        const fn = builtInFunctions.POWER.implementation;
        expect(fn).toBeDefined();

        expect(fn!(2, 10)).toBe(1024);
        expect(fn!(9, 0.5)).toBe(3);
        expect(fn!(5, 0)).toBe(1);
        expect(fn!(2, -1)).toBe(0.5);
    });
});

describe("PseudocodeType.ANY", () => {
    test("ANY is compatible with all scalar types", () => {
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.INTEGER)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.REAL)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.STRING)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.CHAR)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.BOOLEAN)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.DATE)).toBe(true);
        expect(TypeValidator.isCompatible(PseudocodeType.ANY, PseudocodeType.ANY)).toBe(true);
    });

    test("ANY validates any value as true", () => {
        expect(TypeValidator.validateValue(42, PseudocodeType.ANY)).toBe(true);
        expect(TypeValidator.validateValue(3.14, PseudocodeType.ANY)).toBe(true);
        expect(TypeValidator.validateValue("hello", PseudocodeType.ANY)).toBe(true);
        expect(TypeValidator.validateValue(true, PseudocodeType.ANY)).toBe(true);
        expect(TypeValidator.validateValue(null, PseudocodeType.ANY)).toBe(true);
        expect(TypeValidator.validateValue(undefined, PseudocodeType.ANY)).toBe(true);
    });

    test("ANY convertValue returns value unchanged", () => {
        expect(TypeValidator.convertValue(42, PseudocodeType.ANY)).toBe(42);
        expect(TypeValidator.convertValue("hello", PseudocodeType.ANY)).toBe("hello");
        expect(TypeValidator.convertValue(true, PseudocodeType.ANY)).toBe(true);
    });

    test("ANY maps to TypeScript 'any'", () => {
        expect(TypeValidator.mapPseudocodeToType(PseudocodeType.ANY)).toBe("any");
    });
});
