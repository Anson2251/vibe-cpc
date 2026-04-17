import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Variables, constants and data types (CPC 2.1-2.6)", () => {
    describe("2.1 Data type declarations", () => {
        test("DECLARE with INTEGER type", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 42
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("DECLARE with REAL type", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- 3.14
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("3.14");
        });

        test("DECLARE with CHAR type", async () => {
            const { result, output } = await execute(`
DECLARE ch : CHAR
ch <- 'A'
OUTPUT ch
`);
            expect(result.success).toBe(true);
            expect(output).toBe("A");
        });

        test("DECLARE with STRING type", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- "hello"
OUTPUT s
`);
            expect(result.success).toBe(true);
            expect(output).toBe("hello");
        });

        test("DECLARE with BOOLEAN type", async () => {
            const { result, output } = await execute(`
DECLARE flag : BOOLEAN
flag <- TRUE
OUTPUT flag
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("DECLARE with DATE type", async () => {
            const { result, output } = await execute(`
DECLARE d : DATE
d <- SETDATE(15, 6, 2024)
OUTPUT DAY(d)
OUTPUT MONTH(d)
OUTPUT YEAR(d)
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["15", "6", "2024"].join("\n"));
        });
    });

    describe("2.2 Literals", () => {
        test("integer literal: positive", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 5
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("5");
        });

        test("integer literal: negative", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- -3
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("-3");
        });

        test("real literal: with decimal", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- 4.7
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("4.7");
        });

        test("real literal: 0.3", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- 0.3
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("0.3");
        });

        test("real literal: negative -4.0", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- -4.0
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("-4");
        });

        test("char literal: single character", async () => {
            const { result, output } = await execute(`
DECLARE ch : CHAR
ch <- 'a'
OUTPUT ch
`);
            expect(result.success).toBe(true);
            expect(output).toBe("a");
        });

        test("string literal: normal string", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- "This is a string"
OUTPUT s
`);
            expect(result.success).toBe(true);
            expect(output).toBe("This is a string");
        });

        test("string literal: empty string", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- ""
OUTPUT LENGTH(s)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("0");
        });

        test("boolean literal: TRUE and FALSE", async () => {
            const { result, output } = await execute(`
DECLARE a : BOOLEAN
DECLARE b : BOOLEAN
a <- TRUE
b <- FALSE
OUTPUT a
OUTPUT b
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["true", "false"].join("\n"));
        });
    });

    describe("2.4 Variable declarations", () => {
        test("multiple declarations of different types", async () => {
            const { result, output } = await execute(`
DECLARE Counter : INTEGER
DECLARE TotalToPay : REAL
DECLARE GameOver : BOOLEAN
Counter <- 10
TotalToPay <- 9.99
GameOver <- FALSE
OUTPUT Counter
OUTPUT TotalToPay
OUTPUT GameOver
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "9.99", "false"].join("\n"));
        });

        test("rejects duplicate variable declaration", async () => {
            const { result } = await execute(`
DECLARE x : INTEGER
DECLARE x : INTEGER
`);
            expect(result.success).toBe(false);
        });
    });

    describe("2.5 Constants", () => {
        test("CONSTANT declaration and usage", async () => {
            const { result, output } = await execute(`
CONSTANT HourlyRate = 6.50
DECLARE Pay : REAL
Pay <- HourlyRate * 8
OUTPUT Pay
`);
            expect(result.success).toBe(true);
            expect(output).toBe("52");
        });

        test("CONSTANT with string value", async () => {
            const { result, output } = await execute(`
CONSTANT DefaultText = "N/A"
OUTPUT DefaultText
`);
            expect(result.success).toBe(true);
            expect(output).toBe("N/A");
        });

        test("CONSTANT with integer value", async () => {
            const { result, output } = await execute(`
CONSTANT MaxSize = 100
DECLARE x : INTEGER
x <- MaxSize
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("100");
        });

        test("CONSTANT cannot be reassigned", async () => {
            const { result } = await execute(`
CONSTANT Pi = 3.14
Pi <- 3.14159
`);
            expect(result.success).toBe(false);
        });
    });

    describe("2.6 Assignments", () => {
        test("simple assignment", async () => {
            const { result, output } = await execute(`
DECLARE Counter : INTEGER
Counter <- 0
OUTPUT Counter
`);
            expect(result.success).toBe(true);
            expect(output).toBe("0");
        });

        test("assignment with expression", async () => {
            const { result, output } = await execute(`
DECLARE Counter : INTEGER
DECLARE HourlyRate : REAL
DECLARE NumberOfHours : REAL
DECLARE TotalToPay : REAL
Counter <- 0
HourlyRate <- 6.5
NumberOfHours <- 8
TotalToPay <- NumberOfHours * HourlyRate
OUTPUT TotalToPay
`);
            expect(result.success).toBe(true);
            expect(output).toBe("52");
        });

        test("assignment with self-reference", async () => {
            const { result, output } = await execute(`
DECLARE Counter : INTEGER
Counter <- 0
Counter <- Counter + 1
OUTPUT Counter
`);
            expect(result.success).toBe(true);
            expect(output).toBe("1");
        });

        test("INTEGER to REAL implicit conversion", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- 5
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("5");
        });

        test("rejects type mismatch: string assigned to integer", async () => {
            const { result } = await execute(`
DECLARE x : INTEGER
x <- "hello"
`);
            expect(result.success).toBe(false);
        });

        test("rejects type mismatch: integer assigned to string", async () => {
            const { result } = await execute(`
DECLARE s : STRING
s <- 42
`);
            expect(result.success).toBe(false);
        });
    });
});
