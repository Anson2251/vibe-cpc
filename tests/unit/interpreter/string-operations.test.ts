import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("String functions and operations (CPC 5.5, insert)", () => {
    describe("LENGTH", () => {
        test("LENGTH returns string length", async () => {
            const { result, output } = await execute(`OUTPUT LENGTH("Hello")`);
            expect(result.success).toBe(true);
            expect(output).toBe("5");
        });

        test("LENGTH of empty string", async () => {
            const { result, output } = await execute(`OUTPUT LENGTH("")`);
            expect(result.success).toBe(true);
            expect(output).toBe("0");
        });

        test("LENGTH with string variable", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- "Happy Days"
OUTPUT LENGTH(s)
`);
            expect(result.success).toBe(true);
            expect(output).toBe("10");
        });
    });

    describe("LEFT", () => {
        test("LEFT returns leftmost x characters", async () => {
            const { result, output } = await execute(`OUTPUT LEFT("ABCDEFGH", 3)`);
            expect(result.success).toBe(true);
            expect(output).toBe("ABC");
        });

        test("LEFT with length equal to string length", async () => {
            const { result, output } = await execute(`OUTPUT LEFT("ABC", 3)`);
            expect(result.success).toBe(true);
            expect(output).toBe("ABC");
        });

        test("LEFT with length 1", async () => {
            const { result, output } = await execute(`OUTPUT LEFT("Fred", 1)`);
            expect(result.success).toBe(true);
            expect(output).toBe("F");
        });
    });

    describe("RIGHT", () => {
        test("RIGHT returns rightmost x characters", async () => {
            const { result, output } = await execute(`OUTPUT RIGHT("ABCDEFGH", 3)`);
            expect(result.success).toBe(true);
            expect(output).toBe("FGH");
        });

        test("RIGHT with length equal to string length", async () => {
            const { result, output } = await execute(`OUTPUT RIGHT("Fred", 4)`);
            expect(result.success).toBe(true);
            expect(output).toBe("Fred");
        });
    });

    describe("MID", () => {
        test("MID returns substring starting at position x of length y", async () => {
            const { result, output } = await execute(`OUTPUT MID("ABCDEFGH", 2, 3)`);
            expect(result.success).toBe(true);
            expect(output).toBe("BCD");
        });

        test("MID from position 1 length 1", async () => {
            const { result, output } = await execute(`OUTPUT MID("Fred", 1, 1)`);
            expect(result.success).toBe(true);
            expect(output).toBe("F");
        });

        test("MID to end of string", async () => {
            const { result, output } = await execute(`OUTPUT MID("Fred", 2, 3)`);
            expect(result.success).toBe(true);
            expect(output).toBe("red");
        });
    });

    describe("TO_UPPER", () => {
        test("TO_UPPER converts char to uppercase", async () => {
            const { result, output } = await execute(`OUTPUT TO_UPPER('a')`);
            expect(result.success).toBe(true);
            expect(output).toBe("A");
        });

        test("TO_UPPER on already uppercase char", async () => {
            const { result, output } = await execute(`OUTPUT TO_UPPER('Z')`);
            expect(result.success).toBe(true);
            expect(output).toBe("Z");
        });

        test("TO_UPPER converts string to uppercase", async () => {
            const { result, output } = await execute(`OUTPUT TO_UPPER("JIM 803")`);
            expect(result.success).toBe(true);
            expect(output).toBe("JIM 803");
        });

        test("TO_UPPER on mixed case string", async () => {
            const { result, output } = await execute(`OUTPUT TO_UPPER("Hello World")`);
            expect(result.success).toBe(true);
            expect(output).toBe("HELLO WORLD");
        });
    });

    describe("TO_LOWER", () => {
        test("TO_LOWER converts char to lowercase", async () => {
            const { result, output } = await execute(`OUTPUT TO_LOWER('A')`);
            expect(result.success).toBe(true);
            expect(output).toBe("a");
        });

        test("TO_LOWER on already lowercase char", async () => {
            const { result, output } = await execute(`OUTPUT TO_LOWER('z')`);
            expect(result.success).toBe(true);
            expect(output).toBe("z");
        });

        test("TO_LOWER converts string to lowercase", async () => {
            const { result, output } = await execute(`OUTPUT TO_LOWER("JIM 803")`);
            expect(result.success).toBe(true);
            expect(output).toBe("jim 803");
        });
    });

    describe("NUM_TO_STR", () => {
        test("NUM_TO_STR with integer", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- NUM_TO_STR(42)
OUTPUT s
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("NUM_TO_STR with real", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- NUM_TO_STR(3.14)
OUTPUT s
`);
            expect(result.success).toBe(true);
            expect(output).toBe("3.14");
        });

        test("NUM_TO_STR with negative value", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
s <- NUM_TO_STR(-7)
OUTPUT s
`);
            expect(result.success).toBe(true);
            expect(output).toBe("-7");
        });
    });

    describe("STR_TO_NUM", () => {
        test("STR_TO_NUM with integer string", async () => {
            const { result, output } = await execute(`
DECLARE n : REAL
n <- STR_TO_NUM("42")
OUTPUT n
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("STR_TO_NUM with real string", async () => {
            const { result, output } = await execute(`
DECLARE x : REAL
x <- STR_TO_NUM("23.45")
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("23.45");
        });

        test("STR_TO_NUM with invalid string reports error", async () => {
            const { result } = await execute(`OUTPUT STR_TO_NUM("hello")`);
            expect(result.success).toBe(false);
        });
    });

    describe("IS_NUM", () => {
        test("IS_NUM returns TRUE for valid numeric string", async () => {
            const { result, output } = await execute(`OUTPUT IS_NUM("42")`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("IS_NUM returns TRUE for real string", async () => {
            const { result, output } = await execute(`OUTPUT IS_NUM("3.14")`);
            expect(result.success).toBe(true);
            expect(output).toBe("true");
        });

        test("IS_NUM returns FALSE for non-numeric string", async () => {
            const { result, output } = await execute(`OUTPUT IS_NUM("hello")`);
            expect(result.success).toBe(true);
            expect(output).toBe("false");
        });

        test("IS_NUM returns FALSE for empty string", async () => {
            const { result, output } = await execute(`OUTPUT IS_NUM("")`);
            expect(result.success).toBe(true);
            expect(output).toBe("false");
        });
    });

    describe("ASC", () => {
        test("ASC returns ASCII value of character", async () => {
            const { result, output } = await execute(`OUTPUT ASC('A')`);
            expect(result.success).toBe(true);
            expect(output).toBe("65");
        });

        test("ASC with lowercase character", async () => {
            const { result, output } = await execute(`OUTPUT ASC('a')`);
            expect(result.success).toBe(true);
            expect(output).toBe("97");
        });

        test("ASC with digit character", async () => {
            const { result, output } = await execute(`OUTPUT ASC('0')`);
            expect(result.success).toBe(true);
            expect(output).toBe("48");
        });
    });

    describe("CHR", () => {
        test("CHR returns character for ASCII value", async () => {
            const { result, output } = await execute(`OUTPUT CHR(65)`);
            expect(result.success).toBe(true);
            expect(output).toBe("A");
        });

        test("CHR with value 97 returns 'a'", async () => {
            const { result, output } = await execute(`OUTPUT CHR(97)`);
            expect(result.success).toBe(true);
            expect(output).toBe("a");
        });

        test("CHR with out-of-range value reports error", async () => {
            const { result } = await execute(`OUTPUT CHR(200)`);
            expect(result.success).toBe(false);
        });

        test("CHR with negative value reports error", async () => {
            const { result } = await execute(`OUTPUT CHR(-1)`);
            expect(result.success).toBe(false);
        });
    });

    describe("& concatenation operator", () => {
        test("concatenate two string literals", async () => {
            const { result, output } = await execute(`OUTPUT "Summer" & " Pudding"`);
            expect(result.success).toBe(true);
            expect(output).toBe("Summer Pudding");
        });

        test("concatenate string variables", async () => {
            const { result, output } = await execute(`
DECLARE first : STRING
DECLARE last : STRING
first <- "Fred"
last <- "Smith"
OUTPUT first & " " & last
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Fred Smith");
        });

        test("concatenate CHAR with STRING", async () => {
            const { result, output } = await execute(`
DECLARE ch : CHAR
DECLARE s : STRING
ch <- 'X'
s <- "Test"
OUTPUT s & ch
`);
            expect(result.success).toBe(true);
            expect(output).toBe("TestX");
        });
    });

    describe("string functions with variable arguments", () => {
        test("LENGTH, RIGHT, MID with variables", async () => {
            const { result, output } = await execute(`
DECLARE s : STRING
DECLARE n : INTEGER
s <- "Hello World"
n <- 5
OUTPUT LENGTH(s)
OUTPUT RIGHT(s, n)
OUTPUT MID(s, 7, 5)
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["11", "World", "World"].join("\n"));
        });
    });
});
