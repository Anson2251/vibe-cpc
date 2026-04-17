import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Iteration (CPC 7.1-7.3)", () => {
    describe("7.1 Count-controlled (FOR) loops", () => {
        test("FOR loop basic: 1 TO 5", async () => {
            const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 1 TO 5
    OUTPUT i
NEXT i
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["1", "2", "3", "4", "5"].join("\n"));
        });

        test("FOR loop with STEP positive", async () => {
            const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 1 TO 10 STEP 3
    OUTPUT i
NEXT i
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["1", "4", "7", "10"].join("\n"));
        });

        test("FOR loop with STEP negative (counting down)", async () => {
            const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 5 TO 1 STEP -1
    OUTPUT i
NEXT i
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["5", "4", "3", "2", "1"].join("\n"));
        });

        test("FOR loop: start > end with positive step executes zero times", async () => {
            const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 5 TO 1
    OUTPUT i
NEXT i
OUTPUT "done"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("done");
        });

        test("FOR loop: start = end executes once", async () => {
            const { result, output } = await execute(`
DECLARE i : INTEGER
FOR i <- 3 TO 3
    OUTPUT i
NEXT i
`);
            expect(result.success).toBe(true);
            expect(output).toBe("3");
        });

        test("nested FOR loops", async () => {
            const { result, output } = await execute(`
DECLARE Row : INTEGER
DECLARE Column : INTEGER
FOR Row <- 1 TO 2
    FOR Column <- 1 TO 3
        OUTPUT Row * 10 + Column
    NEXT Column
NEXT Row
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["11", "12", "13", "21", "22", "23"].join("\n"));
        });

        test("FOR loop modifies variable inside body", async () => {
            const { result, output } = await execute(`
DECLARE Total : INTEGER
DECLARE i : INTEGER
Total <- 0
FOR i <- 1 TO 5
    Total <- Total + i
NEXT i
OUTPUT Total
`);
            expect(result.success).toBe(true);
            expect(output).toBe("15");
        });

        test("FOR loop with variable bounds", async () => {
            const { result, output } = await execute(`
DECLARE MaxRow : INTEGER
DECLARE Row : INTEGER
MaxRow <- 3
FOR Row <- 1 TO MaxRow
    OUTPUT Row
NEXT Row
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["1", "2", "3"].join("\n"));
        });
    });

    describe("7.2 Post-condition (REPEAT) loops", () => {
        test("REPEAT UNTIL: executes until condition true", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 0
REPEAT
    x <- x + 1
    OUTPUT x
UNTIL x = 3
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["1", "2", "3"].join("\n"));
        });

        test("REPEAT UNTIL: executes at least once even if condition initially true", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
REPEAT
    OUTPUT x
UNTIL x > 5
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });

        test("REPEAT UNTIL with complex condition", async () => {
            const { result, output } = await execute(
                `
DECLARE Password : STRING
Password <- ""
REPEAT
    OUTPUT "Please enter the password"
    INPUT Password
UNTIL Password = "Secret"
`,
                ["Wrong", "Secret"],
            );
            expect(result.success).toBe(true);
            expect(output).toBe(
                ["Please enter the password", "Please enter the password"].join("\n"),
            );
        });

        test("REPEAT UNTIL: loop counter", async () => {
            const { result, output } = await execute(`
DECLARE count : INTEGER
count <- 0
REPEAT
    count <- count + 1
UNTIL count = 5
OUTPUT count
`);
            expect(result.success).toBe(true);
            expect(output).toBe("5");
        });
    });

    describe("7.3 Pre-condition (WHILE) loops", () => {
        test("WHILE: executes while condition true", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 0
WHILE x < 3
    x <- x + 1
    OUTPUT x
ENDWHILE
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["1", "2", "3"].join("\n"));
        });

        test("WHILE: condition initially false, zero iterations", async () => {
            const { result, output } = await execute(`
DECLARE x : INTEGER
x <- 10
WHILE x < 5
    OUTPUT x
    x <- x + 1
ENDWHILE
OUTPUT "done"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("done");
        });

        test("WHILE with complex condition", async () => {
            const { result, output } = await execute(`
DECLARE Number : INTEGER
Number <- 27
WHILE Number > 9
    Number <- Number - 9
ENDWHILE
OUTPUT Number
`);
            expect(result.success).toBe(true);
            expect(output).toBe("9");
        });

        test("WHILE with boolean variable condition", async () => {
            const { result, output } = await execute(`
DECLARE GameOver : BOOLEAN
DECLARE Score : INTEGER
GameOver <- FALSE
Score <- 0
WHILE NOT GameOver
    Score <- Score + 10
    IF Score >= 30 THEN
        GameOver <- TRUE
    ENDIF
ENDWHILE
OUTPUT Score
`);
            expect(result.success).toBe(true);
            expect(output).toBe("30");
        });
    });
});
