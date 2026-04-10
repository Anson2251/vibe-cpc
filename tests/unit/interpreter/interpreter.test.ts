import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

describe("Interpreter (unit)", () => {
    test("parse throws syntax error for malformed input", () => {
        const interpreter = new Interpreter(new MockIO());
        expect(() => interpreter.parse("DECLARE x")).toThrow("Expected ':'");
    });

    test("execute strips full-line comments and blank lines", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute(`
// comment

DECLARE x : INTEGER
x <- 3
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("3");
    });

    test("execute handles escaped newlines in source payload", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute("DECLARE x : INTEGER\\nx <- 7\\nOUTPUT x");

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("7");
    });
});
