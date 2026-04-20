import { Interpreter } from "../../src/interpreter";
import { MockIO } from "../mock-io";

describe("Simple array test", () => {
    test("array assignment and read", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute(`
DECLARE arr : ARRAY[1:3] OF INTEGER

arr[1] <- 10
arr[2] <- 20
arr[3] <- 30

OUTPUT arr[1]
OUTPUT arr[2]
OUTPUT arr[3]
`);

        console.log("Output:", JSON.stringify(io.getOutput()));
        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("10\n20\n30");
    });
});
