import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Selection (CPC 6.1-6.2)", () => {
    describe("6.1 IF statements", () => {
        test("IF THEN ENDIF: condition true", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
IF x > 5 THEN
    OUTPUT "big"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("big");
        });

        test("IF THEN ENDIF: condition false (no output)", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 3
IF x > 5 THEN
    OUTPUT "big"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("");
        });

        test("IF THEN ELSE ENDIF: true branch", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
IF x > 5 THEN
    OUTPUT "big"
ELSE
    OUTPUT "small"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("big");
        });

        test("IF THEN ELSE ENDIF: false branch", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 3
IF x > 5 THEN
    OUTPUT "big"
ELSE
    OUTPUT "small"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("small");
        });

        test("nested IF statements", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 15
IF x > 10 THEN
    IF x > 20 THEN
        OUTPUT "very big"
    ELSE
        OUTPUT "medium big"
    ENDIF
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("medium big");
        });

        test("IF with boolean variable as condition", async () => {
            const { result, output } = await execute(`
DECLARE flag : BOOLEAN
flag <- TRUE
IF flag THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("IF with complex boolean expression", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 7
IF x > 5 AND x < 10 THEN
    OUTPUT "in range"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("in range");
        });

        test("IF with NOT condition", async () => {
            const { result, output } = await execute(`
DECLARE flag : BOOLEAN
flag <- FALSE
IF NOT flag THEN
    OUTPUT "not flag"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("not flag");
        });

        test("multiple sequential IF statements", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 5
IF x > 0 THEN
    OUTPUT "positive"
ENDIF
IF x < 10 THEN
    OUTPUT "single digit"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["positive", "single digit"].join("\n"));
        });

        test("IF modifies variable in true branch", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 5
IF x > 3 THEN
    x <- x + 10
ENDIF
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("15");
        });
    });

    describe("6.2 CASE statements", () => {
        test("CASE with matching value", async () => {
            const { result, output } = await execute(`
DECLARE Move : CHAR
Move <- 'W'
CASE OF Move
    'W' : OUTPUT "up"
    'S' : OUTPUT "down"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("up");
        });

        test("CASE with OTHERWISE clause", async () => {
            const { result, output } = await execute(`
DECLARE Move : CHAR
Move <- 'X'
CASE OF Move
    'W' : OUTPUT "up"
    'S' : OUTPUT "down"
    OTHERWISE : OUTPUT "unknown"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("unknown");
        });

        test("CASE without OTHERWISE and no match produces no output", async () => {
            const { result, output } = await execute(`
DECLARE Move : CHAR
Move <- 'X'
CASE OF Move
    'W' : OUTPUT "up"
    'S' : OUTPUT "down"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("");
        });

        test("CASE with integer selector", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 2
CASE OF x
    1 : OUTPUT "one"
    2 : OUTPUT "two"
    3 : OUTPUT "three"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("two");
        });

        test("CASE with multiple statements in a branch", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 1
CASE OF x
    1 : OUTPUT "one"
        OUTPUT "uno"
    2 : OUTPUT "two"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["one", "uno"].join("\n"));
        });

        test("CASE with TO range", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 5
CASE OF x
    1 TO 3 : OUTPUT "low"
    4 TO 6 : OUTPUT "mid"
    7 TO 9 : OUTPUT "high"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("mid");
        });

        test("CASE tests in sequence: first match wins", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 2
CASE OF x
    1 TO 3 : OUTPUT "first"
    2 TO 5 : OUTPUT "second"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("first");
        });

        test("CASE with string selector", async () => {
            const { result, output } = await execute(`
DECLARE day : STRING
day <- "Monday"
CASE OF day
    "Monday" : OUTPUT "start"
    "Friday" : OUTPUT "end"
    OTHERWISE : OUTPUT "middle"
ENDCASE
`);
            expect(result.success).toBe(true);
            expect(output).toBe("start");
        });
    });
});
