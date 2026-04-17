import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Arithmetic operations (CPC 5.2)", () => {
    test("addition", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 5
OUTPUT a + b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("15");
    });

    test("subtraction", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 5
OUTPUT a - b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("5");
    });

    test("multiplication", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 5
OUTPUT a * b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("50");
    });

    test("division returns REAL even for integer operands", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 4
OUTPUT a / b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("2.5");
    });

    test("DIV integer division", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 3
OUTPUT a DIV b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("3");
    });

    test("MOD modulus", async () => {
        const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 3
OUTPUT a MOD b
`);
        expect(result.success).toBe(true);
        expect(output).toBe("1");
    });

    test("DIV by zero reports error", async () => {
        const { result } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 0
OUTPUT a DIV b
`);
        expect(result.success).toBe(false);
    });

    test("division by zero reports error", async () => {
        const { result } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 0
OUTPUT a / b
`);
        expect(result.success).toBe(false);
    });

    test("MOD by zero reports error", async () => {
        const { result } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 10
b <- 0
OUTPUT a MOD b
`);
        expect(result.success).toBe(false);
    });

    test("multiplication and division have higher precedence than addition and subtraction", async () => {
        const { result, output } = await execute(`
OUTPUT 2 + 3 * 4
`);
        expect(result.success).toBe(true);
        expect(output).toBe("14");
    });

    test("parentheses override operator precedence", async () => {
        const { result, output } = await execute(`
OUTPUT (2 + 3) * 4
`);
        expect(result.success).toBe(true);
        expect(output).toBe("20");
    });

    test("real number arithmetic", async () => {
        const { result, output } = await execute(`
DECLARE x : REAL
DECLARE y : REAL
x <- 3.1
y <- 2.0
OUTPUT x + y
OUTPUT x - y
OUTPUT x * y
OUTPUT x / y
`);
        expect(result.success).toBe(true);
        expect(output).toBe(["5.1", "1.1", "6.2", "1.55"].join("\n"));
    });

    test("negative number arithmetic", async () => {
        const { result, output } = await execute(`
DECLARE x : INTEGER
x <- -5
OUTPUT x + 3
OUTPUT x * 2
`);
        expect(result.success).toBe(true);
        expect(output).toBe(["-2", "-10"].join("\n"));
    });

    test("unary minus in expression", async () => {
        const { result, output } = await execute(`
OUTPUT -3 + 5
`);
        expect(result.success).toBe(true);
        expect(output).toBe("2");
    });

    test("complex expression with multiple operators", async () => {
        const { result, output } = await execute(`
OUTPUT 10 DIV 3
OUTPUT 10 MOD 3
OUTPUT 7 DIV 2
OUTPUT 7 MOD 2
`);
        expect(result.success).toBe(true);
        expect(output).toBe(["3", "1", "3", "1"].join("\n"));
    });
});
