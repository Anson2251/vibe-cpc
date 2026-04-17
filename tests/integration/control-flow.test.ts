import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: Control Flow", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("Control structures", () => {
        test("should execute IF statement", async () => {
            const code = `
        DECLARE x : INTEGER
        x <- 10
        IF x > 5 THEN
          OUTPUT "Greater than 5"
        ELSE
          OUTPUT "Less than or equal to 5"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Greater than 5");
        });

        test("should execute nested IF statements", async () => {
            const code = `
        DECLARE x : INTEGER
        DECLARE y : INTEGER
        x <- 10
        y <- 5
        IF x > 5 THEN
          IF y > 3 THEN
            OUTPUT "Both conditions true"
          ELSE
            OUTPUT "Only x condition true"
          ENDIF
        ELSE
          OUTPUT "x condition false"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Both conditions true");
        });

        test("should execute CASE statement", async () => {
            const code = `
        DECLARE grade : CHAR
        grade <- 'B'
        CASE OF grade
          'A' : OUTPUT "Excellent"
          'B' : OUTPUT "Good"
          'C' : OUTPUT "Average"
          OTHERWISE : OUTPUT "Fail"
        ENDCASE
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Good");
        });
    });

    describe("Loops", () => {
        test("should execute FOR loop", async () => {
            const code = `
        DECLARE i : INTEGER
        FOR i <- 1 TO 5
          OUTPUT i
        NEXT i
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "2", "3", "4", "5"]);
        });

        test("should execute FOR loop with STEP", async () => {
            const code = `
        DECLARE i : INTEGER
        FOR i <- 1 TO 10 STEP 2
          OUTPUT i
        NEXT i
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "3", "5", "7", "9"]);
        });

        test("should execute WHILE loop", async () => {
            const code = `
        DECLARE i : INTEGER
        i <- 1
        WHILE i <= 5
          OUTPUT i
          i <- i + 1
        ENDWHILE
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "2", "3", "4", "5"]);
        });

        test("should execute REPEAT loop", async () => {
            const code = `
        DECLARE i : INTEGER
        i <- 1
        REPEAT
          OUTPUT i
          i <- i + 1
        UNTIL i > 5
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "2", "3", "4", "5"]);
        });
    });

    describe("Procedures and functions", () => {
        test("should execute procedure call", async () => {
            const code = `
        PROCEDURE PrintMessage()
          OUTPUT "Hello from procedure"
        ENDPROCEDURE

        CALL PrintMessage()
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Hello from procedure");
        });

        test("should execute procedure with parameters", async () => {
            const code = `
        PROCEDURE AddNumbers(x : INTEGER, y : INTEGER)
          OUTPUT x + y
        ENDPROCEDURE

        CALL AddNumbers(10, 20)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "30");
        });

        test("should execute function call", async () => {
            const code = `
        FUNCTION Add(x : INTEGER, y : INTEGER) RETURNS INTEGER
          RETURN x + y
        ENDFUNCTION

        DECLARE result : INTEGER
        result <- Add(15, 25)
        OUTPUT result
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "40");
        });

        test("should handle recursive function", async () => {
            const code = `
        FUNCTION Factorial(n : INTEGER) RETURNS INTEGER
          IF n <= 1 THEN
            RETURN 1
          ELSE
            RETURN n * Factorial(n - 1)
          ENDIF
        ENDFUNCTION

        OUTPUT Factorial(5)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "120");
        });
    });

    describe("Edge cases and failure modes", () => {
        test("should fail on division by zero", async () => {
            const code = `
        DECLARE a : INTEGER
        DECLARE b : INTEGER
        a <- 10
        b <- 0
        OUTPUT a DIV b
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Division by zero");
        });

        test("should fail when reading undefined variable", async () => {
            const code = `
        OUTPUT notDeclared
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Undefined variable");
        });

        test("should fail EOF when called with wrong argument count", async () => {
            const code = `
        OUTPUT EOF("a.txt", "b.txt")
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "EOF expects exactly one argument");
        });

        test("should execute descending FOR loop with negative step", async () => {
            const code = `
        DECLARE i : INTEGER
        FOR i <- 5 TO 1 STEP -2
          OUTPUT i
        NEXT i
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "3", "1"]);
        });
    });
});
