import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

describe("Array assignment test", () => {
    test("array element assignment works correctly", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute(`
DECLARE numbers : ARRAY[1:5] OF INTEGER
DECLARE sum : INTEGER
DECLARE i : INTEGER

numbers[1] <- 10
numbers[2] <- 20
numbers[3] <- 30
numbers[4] <- 40
numbers[5] <- 50

sum <- 0
FOR i <- 1 TO 5
    sum <- sum + numbers[i]
NEXT i

OUTPUT sum
`);

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("150");
    });
});
