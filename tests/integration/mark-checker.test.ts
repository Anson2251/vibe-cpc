import { TestRunner, expectOutput } from "../test-helpers";

describe("Integration: Percentage Mark Checker", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    const code = `
DECLARE PercentageMark: INTEGER
OUTPUT "Please enter a mark "
INPUT PercentageMark
IF PercentageMark < 0 OR PercentageMark > 100
    THEN
        OUTPUT "Invalid Mark"
    ELSE
        IF PercentageMark > 49
        THEN
            OUTPUT "Pass"
        ELSE
            OUTPUT "Fail"
        ENDIF
ENDIF
`;

    test("should output Pass for a passing mark", async () => {
        const result = await testRunner.runCode(code, ["75"]);
        expectOutput(result, ["Please enter a mark ", "Pass"]);
    });

    test("should output Fail for a failing mark", async () => {
        const result = await testRunner.runCode(code, ["30"]);
        expectOutput(result, ["Please enter a mark ", "Fail"]);
    });

    test("should output Invalid Mark for a negative mark", async () => {
        const result = await testRunner.runCode(code, ["-5"]);
        expectOutput(result, ["Please enter a mark ", "Invalid Mark"]);
    });

    test("should output Invalid Mark for a mark above 100", async () => {
        const result = await testRunner.runCode(code, ["150"]);
        expectOutput(result, ["Please enter a mark ", "Invalid Mark"]);
    });

    test("should output Invalid Mark for exactly 0", async () => {
        const result = await testRunner.runCode(code, ["0"]);
        expectOutput(result, ["Please enter a mark ", "Fail"]);
    });

    test("should output Pass for exactly 100", async () => {
        const result = await testRunner.runCode(code, ["100"]);
        expectOutput(result, ["Please enter a mark ", "Pass"]);
    });

    test("should output Pass for exactly 50", async () => {
        const result = await testRunner.runCode(code, ["50"]);
        expectOutput(result, ["Please enter a mark ", "Pass"]);
    });
});
