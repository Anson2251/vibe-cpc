import builtInFunctions from "../../../src/runtime/builtin-functions";

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
});
