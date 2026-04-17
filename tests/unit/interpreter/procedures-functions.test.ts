import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Procedures and functions (CPC 8.1-8.3)", () => {
    describe("8.1 Defining and calling procedures", () => {
        test("procedure with no parameters", async () => {
            const { result, output } = await execute(`
PROCEDURE Greet
    OUTPUT "Hello"
ENDPROCEDURE

CALL Greet
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Hello");
        });

        test("procedure with parameters", async () => {
            const { result, output } = await execute(`
PROCEDURE Square(Size : INTEGER)
    OUTPUT Size * Size
ENDPROCEDURE

CALL Square(5)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("25");
        });

        test("procedure with multiple parameters", async () => {
            const { result, output } = await execute(`
PROCEDURE PrintSum(a : INTEGER, b : INTEGER)
    OUTPUT a + b
ENDPROCEDURE

CALL PrintSum(3, 7)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });

        test("procedure modifies global variable", async () => {
            const { result, output } = await execute(`
DECLARE Counter : INTEGER
Counter <- 0

PROCEDURE Increment
    Counter <- Counter + 1
ENDPROCEDURE

CALL Increment
CALL Increment
OUTPUT Counter
`);
            expect(result.success).toBe(true);
            expect(output).toBe("2");
        });

        test("procedure calls another procedure", async () => {
            const { result, output } = await execute(`
PROCEDURE Inner
    OUTPUT "inner"
ENDPROCEDURE

PROCEDURE Outer
    OUTPUT "before"
    CALL Inner
    OUTPUT "after"
ENDPROCEDURE

CALL Outer
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["before", "inner", "after"].join("\n"));
        });

        test("procedure with no parameters: CALL without parentheses", async () => {
            const { result, output } = await execute(`
PROCEDURE DefaultSquare
    OUTPUT "default"
ENDPROCEDURE

CALL DefaultSquare
`);
            expect(result.success).toBe(true);
            expect(output).toBe("default");
        });
    });

    describe("8.2 Defining and calling functions", () => {
        test("function with no parameters", async () => {
            const { result, output } = await execute(`
FUNCTION GetValue RETURNS INTEGER
    RETURN 42
ENDFUNCTION

OUTPUT GetValue()
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("function with parameters", async () => {
            const { result, output } = await execute(`
FUNCTION Max(Number1 : INTEGER, Number2 : INTEGER) RETURNS INTEGER
    IF Number1 > Number2 THEN
        RETURN Number1
    ELSE
        RETURN Number2
    ENDIF
ENDFUNCTION

OUTPUT Max(10, 20)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("20");
        });

        test("function used in expression", async () => {
            const { result, output } = await execute(`
FUNCTION Double(x : INTEGER) RETURNS INTEGER
    RETURN x * 2
ENDFUNCTION

OUTPUT Double(5) + 1
`);
            expect(result.success).toBe(true);
            expect(output).toBe("11");
        });

        test("function returns REAL type", async () => {
            const { result, output } = await execute(`
FUNCTION Half(x : INTEGER) RETURNS REAL
    RETURN x / 2
ENDFUNCTION

OUTPUT Half(5)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("2.5");
        });

        test("function returns STRING type", async () => {
            const { result, output } = await execute(`
FUNCTION Greet(name : STRING) RETURNS STRING
    RETURN "Hello " & name
ENDFUNCTION

OUTPUT Greet("World")
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Hello World");
        });

        test("function returns BOOLEAN type", async () => {
            const { result, output } = await execute(`
FUNCTION IsPositive(x : INTEGER) RETURNS BOOLEAN
    IF x > 0 THEN
        RETURN TRUE
    ELSE
        RETURN FALSE
    ENDIF
ENDFUNCTION

IF IsPositive(5) THEN
    OUTPUT "positive"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("positive");
        });

        test("RETURN exits function immediately", async () => {
            const { result, output } = await execute(`
FUNCTION EarlyReturn RETURNS INTEGER
    RETURN 1
    OUTPUT "unreachable"
ENDFUNCTION

OUTPUT EarlyReturn()
`);
            expect(result.success).toBe(true);
            expect(output).toBe("1");
        });

        test("CALL should not be used with functions", async () => {
            const { result } = await execute(`
FUNCTION GetValue RETURNS INTEGER
    RETURN 42
ENDFUNCTION

CALL GetValue()
`);
            expect(result.success).toBe(false);
        });

        test("nested function calls", async () => {
            const { result, output } = await execute(`
FUNCTION Double(x : INTEGER) RETURNS INTEGER
    RETURN x * 2
ENDFUNCTION

FUNCTION AddOne(x : INTEGER) RETURNS INTEGER
    RETURN x + 1
ENDFUNCTION

OUTPUT Double(AddOne(4))
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });
    });

    describe("8.3 Passing parameters by value or by reference", () => {
        test("BYREF: procedure can modify caller's variable", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10

PROCEDURE Modify(BYREF val : INTEGER)
    val <- 99
ENDPROCEDURE

CALL Modify(x)
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("99");
        });

        test("BYVAL: procedure cannot modify caller's variable", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10

PROCEDURE Modify(BYVAL val : INTEGER)
    val <- 99
ENDPROCEDURE

CALL Modify(x)
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });

        test("default is BYVAL when not specified", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10

PROCEDURE Modify(val : INTEGER)
    val <- 99
ENDPROCEDURE

CALL Modify(x)
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });

        test("BYREF swap procedure", async () => {
            const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 1
b <- 2

PROCEDURE SWAP(BYREF X : INTEGER, BYREF Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp <- X
    X <- Y
    Y <- Temp
ENDPROCEDURE

CALL SWAP(a, b)
OUTPUT a
OUTPUT b
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["2", "1"].join("\n"));
        });

        test("BYREF with multiple parameters: keyword need not be repeated", async () => {
            const { result, output } = await execute(`
DECLARE a : INTEGER
DECLARE b : INTEGER
a <- 1
b <- 2

PROCEDURE ModifyBoth(BYREF X : INTEGER, BYREF Y : INTEGER)
    X <- 10
    Y <- 20
ENDPROCEDURE

CALL ModifyBoth(a, b)
OUTPUT a
OUTPUT b
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "20"].join("\n"));
        });
    });
});
