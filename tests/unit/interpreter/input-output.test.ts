import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Input and Output (CPC 5.1)", () => {
    describe("OUTPUT", () => {
        test("OUTPUT a single value", async () => {
            const { result, output } = await execute(`
OUTPUT 42
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("OUTPUT a string literal", async () => {
            const { result, output } = await execute(`
OUTPUT "Hello World"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Hello World");
        });

        test("OUTPUT multiple values separated by commas", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
OUTPUT "The value is ", x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("The value is 10");
        });

        test("OUTPUT three values separated by commas", async () => {
            const { result, output } = await execute(`
DECLARE name : STRING
DECLARE age : INTEGER
name <- "Ali"
age <- 20
OUTPUT name, " is ", age
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Ali is 20");
        });

        test("OUTPUT boolean value", async () => {
            const { result, output } = await execute(`
DECLARE flag : BOOLEAN
flag <- TRUE
OUTPUT flag
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("OUTPUT real value", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- 3.14
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("3.14");
        });

        test("OUTPUT char value", async () => {
            const { result, output } = await execute(`
DECLARE ch : CHAR
ch <- 'A'
OUTPUT ch
`);
            expect(result.success).toBe(true);
            expect(output).toBe("A");
        });

        test("OUTPUT expression result", async () => {
            const { result, output } = await execute(`
OUTPUT 2 + 3 * 4
`);
            expect(result.success).toBe(true);
            expect(output).toBe("14");
        });
    });

    describe("INPUT", () => {
        test("INPUT reads a string", async () => {
            const { result, output } = await execute(
                `
DECLARE name : STRING
INPUT name
OUTPUT name
`,
                ["Alice"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("Alice");
        });

        test("INPUT reads an integer", async () => {
            const { result, output } = await execute(
                `
DECLARE x : INTEGER
INPUT x
OUTPUT x + 1
`,
                ["42"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("43");
        });

        test("INPUT reads a real number", async () => {
            const { result, output } = await execute(
                `
DECLARE x : REAL
INPUT x
OUTPUT x
`,
                ["3.14"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("3.14");
        });

        test("multiple INPUT calls", async () => {
            const { result, output } = await execute(
                `
DECLARE a : INTEGER
DECLARE b : INTEGER
INPUT a
INPUT b
OUTPUT a + b
`,
                ["10", "20"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("30");
        });

        test("INPUT reads into a 1D array element", async () => {
            const { result, output } = await execute(
                `
DECLARE arr : ARRAY[1:3] OF INTEGER
INPUT arr[2]
OUTPUT arr[2] + 1
`,
                ["42"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("43");
        });

        test("INPUT reads into a 2D array element", async () => {
            const { result, output } = await execute(
                `
DECLARE matrix : ARRAY[1:2, 1:3] OF INTEGER
INPUT matrix[2, 1]
OUTPUT matrix[2, 1]
`,
                ["99"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("99");
        });

        test("INPUT reads into an array element with an index variable", async () => {
            const { result, output } = await execute(
                `
DECLARE grid : ARRAY[1:2, 1:2] OF STRING
DECLARE row : INTEGER
DECLARE col : INTEGER
row <- 1
col <- 2
INPUT grid[row, col]
OUTPUT grid[row, col]
`,
                ["hello"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("hello");
        });

        test("INPUT with prompt reads into an array element", async () => {
            const { result, output } = await execute(
                `
DECLARE scores : ARRAY[1:3] OF REAL
INPUT "Score: " scores[1]
OUTPUT scores[1]
`,
                ["3.25"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("Score: 3.25");
        });

        test("INPUT rejects wrong type into an array element", async () => {
            const { result } = await execute(
                `
DECLARE arr : ARRAY[1:3] OF INTEGER
INPUT arr[1]
`,
                ["hello"],
            );
            expect(result.success).toBe(false);
        });

        test("INPUT reads into a field of a user-defined type", async () => {
            const { result, output } = await execute(
                `
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord
INPUT Pupil.LastName
INPUT Pupil.YearGroup
OUTPUT Pupil.LastName
OUTPUT Pupil.YearGroup
`,
                ["Ali", "7"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "7"].join("\n"));
        });

        test("INPUT with prompt reads into a field of a user-defined type", async () => {
            const { result, output } = await execute(
                `
TYPE StudentRecord
    DECLARE LastName : STRING
ENDTYPE

DECLARE Pupil : StudentRecord
INPUT "Name: " Pupil.LastName
OUTPUT Pupil.LastName
`,
                ["Bob"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("Name: Bob");
        });

        test("INPUT reads into a field of an array of user-defined type", async () => {
            const { result, output } = await execute(
                `
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Form : ARRAY[1:2] OF StudentRecord
INPUT Form[1].LastName
INPUT Form[1].YearGroup
OUTPUT Form[1].LastName
OUTPUT Form[1].YearGroup
`,
                ["Ali", "6"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "6"].join("\n"));
        });

        test("INPUT reads through a pointer dereference", async () => {
            const { result, output } = await execute(
                `
TYPE IntPtr = ^INTEGER
DECLARE x : INTEGER
x <- 10
DECLARE p : IntPtr
p <- ^x
INPUT p^
OUTPUT p^
`,
                ["99"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe("99");
        });

        test("INPUT rejects wrong type into a member access", async () => {
            const { result } = await execute(
                `
TYPE StudentRecord
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord
INPUT Pupil.YearGroup
`,
                ["Six"],
            );
            expect(result.success).toBe(false);
        });

        test("INPUT rejects wrong type: string to integer", async () => {
            const { result } = await execute(
                `
DECLARE x : INTEGER
INPUT x
`,
                ["hello"],
            );
            expect(result.success).toBe(false);
        });
    });
});
