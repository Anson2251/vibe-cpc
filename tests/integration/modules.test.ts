import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: Modules", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("CAIE_ONLY mode", () => {
        test("should allow CAIE standard functions in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        DECLARE s : STRING
        s <- "Hello"
        OUTPUT LENGTH(s)
        OUTPUT LEFT(s, 3)
        OUTPUT TO_UPPER(s)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "Hel", "HELLO"]);
        });

        test("should block POSITION in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT POSITION("Hello", "l")
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block ROUND in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT ROUND(3.14, 1)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block TYPEOF in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT TYPEOF(42)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block ABS, SQRT, POWER, REPLACE, TRIM in CAIE_ONLY mode", async () => {
            const codes = [
                "OUTPUT ABS(-1)",
                "OUTPUT SQRT(4)",
                "OUTPUT POWER(2, 3)",
                'OUTPUT REPLACE("abc", "b", "x")',
                'OUTPUT TRIM("  hi  ")',
            ];

            for (const expr of codes) {
                const code = `// CAIE_ONLY\n${expr}`;
                const result = await testRunner.runCode(code);
                expectError(result, "not a CAIE standard function");
            }
        });

        test("should allow extended functions without CAIE_ONLY", async () => {
            const code = `
        OUTPUT SQRT(25)
        OUTPUT TYPEOF(42)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "INTEGER"]);
        });

        test("should not detect CAIE_ONLY when comment is not on first line", async () => {
            const code = `
        OUTPUT SQRT(25)
        // CAIE_ONLY
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "5");
        });
    });

    describe("IMPORT and EXPORT", () => {
        test("should import and call exported function", async () => {
            testRunner.setFileContent(
                "mathlib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Multiply(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * B
ENDFUNCTION

EXPORT Add, Multiply
            `,
            );

            const code = `
IMPORT "mathlib"
OUTPUT Add(3, 4)
OUTPUT Multiply(2, 5)
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["7", "10"]);
        });

        test("should import with namespace using CONSTANT", async () => {
            testRunner.setFileContent(
                "mathlib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Multiply(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * B
ENDFUNCTION

EXPORT Add, Multiply
            `,
            );

            const code = `
CONSTANT math = IMPORT "mathlib"
OUTPUT math.Add(3, 4)
OUTPUT math.Multiply(2, 5)
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["7", "10"]);
        });

        test("should not import unexported declarations", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Visible() RETURNS STRING
    RETURN "visible"
ENDFUNCTION

FUNCTION Hidden() RETURNS STRING
    RETURN "hidden"
ENDFUNCTION

EXPORT Visible
            `,
            );

            const code = `
IMPORT "lib"
OUTPUT Visible()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "visible");
        });

        test("should not import anything when no EXPORT statement", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION
            `,
            );

            const code = `
IMPORT "lib"
OUTPUT Add(1, 2)
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "Add");
        });

        test("should block IMPORT in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
IMPORT "lib"
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "IMPORT is not a CAIE standard feature");
        });

        test("should block EXPORT in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
EXPORT Add
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "EXPORT is not a CAIE standard feature");
        });

        test("should block DEBUGGER in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
DECLARE x : INTEGER
DEBUGGER
x <- 5
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "DEBUGGER is not a CAIE standard feature");
        });

        test("should error on unknown namespace", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

EXPORT Add
            `,
            );

            const code = `
CONSTANT math = IMPORT "lib"
OUTPUT unknown.Add(1, 2)
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown namespace");
        });

        test("should error on unexported function in namespace", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Secret() RETURNS STRING
    RETURN "secret"
ENDFUNCTION

EXPORT Add
            `,
            );

            const code = `
CONSTANT math = IMPORT "lib"
OUTPUT math.Secret()
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "is not exported from");
        });

        test("should export procedures", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
PROCEDURE Greet(Name : STRING)
    OUTPUT "Hello, " & Name
ENDPROCEDURE

EXPORT Greet
            `,
            );

            const code = `
IMPORT "lib"
CALL Greet("World")
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Hello, World");
        });
    });
});
