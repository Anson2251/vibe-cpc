import { Interpreter } from "../../src/interpreter";
import { MockIO } from "../mock-io";

describe("Array parameter test", () => {
  test("array passed to function", async () => {
    const io = new MockIO();
    const interpreter = new Interpreter(io);

    const result = await interpreter.execute(`
FUNCTION GetFirst(arr : ARRAY[1:3] OF INTEGER) RETURNS INTEGER
  RETURN arr[1]
ENDFUNCTION

DECLARE arr : ARRAY[1:3] OF INTEGER

arr[1] <- 10
arr[2] <- 20
arr[3] <- 30

OUTPUT GetFirst(arr)
`);

    console.log("Output:", JSON.stringify(io.getOutput()));
    expect(result.success).toBe(true);
    expect(io.getOutput().trim()).toBe("10");
  });
});
