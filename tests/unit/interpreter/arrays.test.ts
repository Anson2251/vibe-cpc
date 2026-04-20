import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Arrays (CPC 3.1-3.2)", () => {
    describe("3.1 Declaring arrays", () => {
        test("one-dimensional array declaration and access", async () => {
            const { result, output } = await execute(`
DECLARE StudentNames : ARRAY[1:30] OF STRING
StudentNames[1] <- "Ali"
OUTPUT StudentNames[1]
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Ali");
        });

        test("two-dimensional array declaration and access", async () => {
            const { result, output } = await execute(`
DECLARE NoughtsAndCrosses : ARRAY[1:3,1:3] OF CHAR
NoughtsAndCrosses[2,3] <- 'X'
OUTPUT NoughtsAndCrosses[2,3]
`);
            expect(result.success).toBe(true);
            expect(output).toBe("X");
        });

        test("array of INTEGER type", async () => {
            const { result, output } = await execute(`
DECLARE Scores : ARRAY[1:5] OF INTEGER
Scores[1] <- 90
Scores[2] <- 85
OUTPUT Scores[1]
OUTPUT Scores[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["90", "85"].join("\n"));
        });

        test("array of REAL type", async () => {
            const { result, output } = await execute(`
DECLARE Prices : ARRAY[1:3] OF REAL
Prices[1] <- 9.99
Prices[2] <- 1.5
OUTPUT Prices[1]
OUTPUT Prices[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["9.99", "1.5"].join("\n"));
        });

        test("array of BOOLEAN type", async () => {
            const { result, output } = await execute(`
DECLARE Flags : ARRAY[1:2] OF BOOLEAN
Flags[1] <- TRUE
Flags[2] <- FALSE
OUTPUT Flags[1]
OUTPUT Flags[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["true", "false"].join("\n"));
        });

        test("array with lower bound not 1", async () => {
            const { result, output } = await execute(`
DECLARE Values : ARRAY[0:2] OF INTEGER
Values[0] <- 10
Values[1] <- 20
Values[2] <- 30
OUTPUT Values[0]
OUTPUT Values[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "30"].join("\n"));
        });
    });

    describe("3.2 Using arrays", () => {
        test("array index with expression", async () => {
            const { result, output } = await execute(`
DECLARE StudentNames : ARRAY[1:30] OF STRING
DECLARE n : INTEGER
n <- 1
StudentNames[n] <- "Ali"
StudentNames[n+1] <- "Bob"
OUTPUT StudentNames[1]
OUTPUT StudentNames[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "Bob"].join("\n"));
        });

        test("array index with subtraction expression", async () => {
            const { result, output } = await execute(`
DECLARE data : ARRAY[1:5] OF INTEGER
DECLARE i : INTEGER
data[1] <- 10
data[2] <- 20
data[3] <- 30
i <- 2
OUTPUT data[i-1]
OUTPUT data[i]
OUTPUT data[i+1]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "20", "30"].join("\n"));
        });

        test("array element assignment from another element", async () => {
            const { result, output } = await execute(`
DECLARE StudentNames : ARRAY[1:30] OF STRING
DECLARE n : INTEGER
n <- 1
StudentNames[1] <- "Ali"
StudentNames[n+1] <- StudentNames[n]
OUTPUT StudentNames[2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Ali");
        });

        test("whole array assignment", async () => {
            const { result, output } = await execute(`
DECLARE NoughtsAndCrosses : ARRAY[1:3,1:3] OF CHAR
DECLARE SavedGame : ARRAY[1:3,1:3] OF CHAR
NoughtsAndCrosses[1,1] <- 'X'
NoughtsAndCrosses[2,2] <- 'O'
SavedGame <- NoughtsAndCrosses
OUTPUT SavedGame[1,1]
OUTPUT SavedGame[2,2]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["X", "O"].join("\n"));
        });

        test("whole array assignment creates independent copy", async () => {
            const { result, output } = await execute(`
DECLARE Src : ARRAY[1:2] OF INTEGER
DECLARE Dst : ARRAY[1:2] OF INTEGER
Src[1] <- 10
Src[2] <- 20
Dst <- Src
Dst[1] <- 99
OUTPUT Src[1]
OUTPUT Dst[1]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "99"].join("\n"));
        });

        test("populate array using FOR loop", async () => {
            const { result, output } = await execute(`
DECLARE Values : ARRAY[1:5] OF INTEGER
DECLARE i : INTEGER
FOR i <- 1 TO 5
    Values[i] <- i * 10
NEXT i
FOR i <- 1 TO 5
    OUTPUT Values[i]
NEXT i
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["10", "20", "30", "40", "50"].join("\n"));
        });

        test("out-of-bounds access reports error", async () => {
            const { result } = await execute(`
DECLARE Values : ARRAY[1:3] OF INTEGER
OUTPUT Values[4]
`);
            expect(result.success).toBe(false);
        });

        test("wrong type assignment to array element reports error", async () => {
            const { result } = await execute(`
DECLARE Values : ARRAY[1:3] OF INTEGER
Values[1] <- "hello"
`);
            expect(result.success).toBe(false);
        });

        test("non-integer array index reports error", async () => {
            const { result } = await execute(`
DECLARE Values : ARRAY[1:3] OF INTEGER
Values[1.5] <- 7
`);
            expect(result.success).toBe(false);
        });

        test("two-dimensional array full traversal", async () => {
            const { result, output } = await execute(`
DECLARE Matrix : ARRAY[1:2,1:3] OF INTEGER
DECLARE i : INTEGER
DECLARE j : INTEGER
FOR i <- 1 TO 2
    FOR j <- 1 TO 3
        Matrix[i,j] <- i * 10 + j
    NEXT j
NEXT i
OUTPUT Matrix[1,1]
OUTPUT Matrix[1,2]
OUTPUT Matrix[1,3]
OUTPUT Matrix[2,1]
OUTPUT Matrix[2,2]
OUTPUT Matrix[2,3]
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["11", "12", "13", "21", "22", "23"].join("\n"));
        });
    });
});
