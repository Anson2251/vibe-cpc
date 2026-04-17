import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: File Operations", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("File operations", () => {
        test("should handle file writing and reading", async () => {
            const code = `
        DECLARE line : STRING
        OPENFILE "test.txt" FOR WRITE
        WRITEFILE "test.txt", "Hello, file!"
        CLOSEFILE "test.txt"

        OPENFILE "test.txt" FOR READ
        READFILE "test.txt", line
        OUTPUT line
        CLOSEFILE "test.txt"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Hello, file!");
        });

        test("should support EOF loop over text files", async () => {
            const code = `
        DECLARE line : STRING
        OPENFILE "input.txt" FOR WRITE
        WRITEFILE "input.txt", "Alpha"
        WRITEFILE "input.txt", "Beta"
        CLOSEFILE "input.txt"

        OPENFILE "input.txt" FOR READ
        WHILE NOT EOF("input.txt")
          READFILE "input.txt", line
          OUTPUT line
        ENDWHILE
        CLOSEFILE "input.txt"
      `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["Alpha", "Beta"]);
        });

        test("should support random file seek, putrecord and getrecord", async () => {
            const code = `
TYPE Record
    DECLARE Value : STRING
ENDTYPE

DECLARE rec : Record
OPENFILE "records.dat" FOR RANDOM
rec.Value <- "First"
SEEK "records.dat", 1
PUTRECORD "records.dat", rec
rec.Value <- "Second"
SEEK "records.dat", 2
PUTRECORD "records.dat", rec
SEEK "records.dat", 2
GETRECORD "records.dat", rec
OUTPUT rec.Value
CLOSEFILE "records.dat"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Second");
        });

        test("should fail reading file opened in WRITE mode", async () => {
            const code = `
        DECLARE line : STRING
        OPENFILE "mode.txt" FOR WRITE
        READFILE "mode.txt", line
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "open in WRITE mode");
        });

        test("should fail seek for negative random record position", async () => {
            const code = `
        OPENFILE "records.dat" FOR RANDOM
        SEEK "records.dat", -1
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Invalid random file position");
        });
    });
});
