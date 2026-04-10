import { Environment } from "../../../src/runtime/environment";
import { PseudocodeType } from "../../../src/types";

describe("Environment", () => {
    test("supports parent scope lookup and child assignment propagation", () => {
        const parent = new Environment();
        parent.define("counter", PseudocodeType.INTEGER, 1);

        const child = parent.createChild();
        expect(child.get("counter")).toBe(1);

        child.assign("counter", 2);
        expect(parent.get("counter")).toBe(2);
    });

    test("throws for duplicate declaration in same scope", () => {
        const env = new Environment();
        env.define("name", PseudocodeType.STRING, "A");

        expect(() => env.define("name", PseudocodeType.STRING, "B")).toThrow(
            "already declared",
        );
    });

    test("throws for assigning undefined variable", () => {
        const env = new Environment();
        expect(() => env.assign("missing", 1)).toThrow("Undefined variable 'missing'");
    });

    test("enforces constant assignment rule", () => {
        const env = new Environment();
        env.define("PI", PseudocodeType.REAL, 3.14, true);

        expect(() => env.assign("PI", 3.14159)).toThrow("Cannot assign to constant");
    });

    test("validates runtime type on assignment", () => {
        const env = new Environment();
        env.define("age", PseudocodeType.INTEGER, 18);

        expect(() => env.assign("age", "18")).toThrow("Expected INTEGER");
    });
});
