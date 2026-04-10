import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string) {
    const io = new MockIO();
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Interpreter control flow (unit)", () => {
    test("IF/ELSE executes correct branch", async () => {
        const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 2
IF x > 3 THEN
  OUTPUT "big"
ELSE
  OUTPUT "small"
ENDIF
`);

        expect(result.success).toBe(true);
        expect(output).toBe("small");
    });

    test("CASE executes range branch and skips OTHERWISE", async () => {
        const { result, output } = await execute(`
DECLARE score : INTEGER
score <- 35
CASE OF score
  0 TO 39 : OUTPUT "F"
  40 TO 59 : OUTPUT "P"
  OTHERWISE : OUTPUT "?"
ENDCASE
`);

        expect(result.success).toBe(true);
        expect(output).toBe("F");
    });

    test("FOR loop supports positive and negative STEP", async () => {
        const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 1 TO 5 STEP 2
  OUTPUT i
NEXT i
FOR i <- 5 TO 1 STEP -2
  OUTPUT i
NEXT i
`);

        expect(result.success).toBe(true);
        expect(output).toBe(["1", "3", "5", "5", "3", "1"].join("\n"));
    });

    test("WHILE and REPEAT-UNTIL both terminate as expected", async () => {
        const { result, output } = await execute(`
DECLARE n : INTEGER
n <- 0
WHILE n < 3
  OUTPUT n
  n <- n + 1
ENDWHILE

REPEAT
  OUTPUT n
  n <- n + 1
UNTIL n = 4
`);

        expect(result.success).toBe(true);
        expect(output).toBe(["0", "1", "2", "3"].join("\n"));
    });

    test("FOR loop reports friendly runtime error for non-numeric bounds", async () => {
        const { result } = await execute(`
DECLARE i : INTEGER
FOR i <- "x" TO 3
  OUTPUT i
NEXT i
`);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("Expected numeric value");
    });
});
