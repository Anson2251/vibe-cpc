import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Relational and logic operations (CPC 5.3-5.4)", () => {
    describe("5.3 Relational operations", () => {
        test("greater than >", async () => {
            const { result, output } = await execute(`
IF 5 > 3 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("less than <", async () => {
            const { result, output } = await execute(`
IF 3 < 5 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("greater than or equal >=", async () => {
            const { result, output } = await execute(`
IF 5 >= 5 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("less than or equal <=", async () => {
            const { result, output } = await execute(`
IF 5 <= 5 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("equal to =", async () => {
            const { result, output } = await execute(`
IF 5 = 5 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("not equal <>", async () => {
            const { result, output } = await execute(`
IF 5 <> 3 THEN
    OUTPUT "true"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("relational result is BOOLEAN", async () => {
            const { result, output } = await execute(`
DECLARE b : BOOLEAN
b <- 5 > 3
OUTPUT b
b <- 5 = 3
OUTPUT b
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["true", "false"].join("\n"));
        });

        test("string comparison with =", async () => {
            const { result, output } = await execute(`
IF "hello" = "hello" THEN
    OUTPUT "equal"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("equal");
        });

        test("string comparison with <>", async () => {
            const { result, output } = await execute(`
IF "hello" <> "world" THEN
    OUTPUT "different"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("different");
        });

        test("CHAR comparison", async () => {
            const { result, output } = await execute(`
DECLARE ch : CHAR
ch <- 'A'
IF ch = 'A' THEN
    OUTPUT "match"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("match");
        });

        test("relational with expressions", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
IF x * 2 > 15 THEN
    OUTPUT "big"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("big");
        });
    });

    describe("5.4 Logic operators", () => {
        test("AND: both true", async () => {
            const { result, output } = await execute(`
IF TRUE AND TRUE THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("AND: one false", async () => {
            const { result, output } = await execute(`
IF TRUE AND FALSE THEN
    OUTPUT "yes"
ELSE
    OUTPUT "no"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("no");
        });

        test("OR: one true", async () => {
            const { result, output } = await execute(`
IF TRUE OR FALSE THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("OR: both false", async () => {
            const { result, output } = await execute(`
IF FALSE OR FALSE THEN
    OUTPUT "yes"
ELSE
    OUTPUT "no"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("no");
        });

        test("NOT: negates true", async () => {
            const { result, output } = await execute(`
IF NOT FALSE THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("NOT: negates false", async () => {
            const { result, output } = await execute(`
IF NOT TRUE THEN
    OUTPUT "yes"
ELSE
    OUTPUT "no"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("no");
        });

        test("complex boolean expression with parentheses", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 7
IF (x > 5) AND (x < 10) THEN
    OUTPUT "in range"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("in range");
        });

        test("AND combined with relational operators", async () => {
            const { result, output } = await execute(`
DECLARE score : INTEGER
score <- 75
IF score >= 40 AND score <= 100 THEN
    OUTPUT "pass"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("pass");
        });

        test("OR combined with relational operators", async () => {
            const { result, output } = await execute(`
DECLARE day : STRING
day <- "Saturday"
IF day = "Saturday" OR day = "Sunday" THEN
    OUTPUT "weekend"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("weekend");
        });

        test("NOT with relational expression", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 5
IF NOT (x > 10) THEN
    OUTPUT "not greater"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("not greater");
        });

        test("boolean result stored in variable", async () => {
            const { result, output } = await execute(`
DECLARE a : BOOLEAN
DECLARE b : BOOLEAN
a <- TRUE
b <- NOT a
OUTPUT a
OUTPUT b
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["true", "false"].join("\n"));
        });
    });
});
