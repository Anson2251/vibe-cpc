import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("File handling (CPC 9.1-9.2)", () => {
    describe("9.1 Handling text files", () => {
        test("OPENFILE for WRITE and WRITEFILE", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "Hello"
WRITEFILE "test.txt", "World"
CLOSEFILE "test.txt"
OUTPUT "done"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("done");
        });

        test("OPENFILE for READ and READFILE", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "Hello"
WRITEFILE "test.txt", "World"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
READFILE "test.txt", line
OUTPUT line
READFILE "test.txt", line
OUTPUT line
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Hello", "World"].join("\n"));
        });

        test("EOF returns TRUE when no more lines", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "Only line"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
READFILE "test.txt", line
IF EOF("test.txt") THEN
    OUTPUT "end"
ENDIF
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("end");
        });

        test("EOF returns FALSE when more lines remain", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "Line1"
WRITEFILE "test.txt", "Line2"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
READFILE "test.txt", line
IF NOT EOF("test.txt") THEN
    OUTPUT "more"
ENDIF
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("more");
        });

        test("WHILE NOT EOF reads all lines", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "A"
WRITEFILE "test.txt", "B"
WRITEFILE "test.txt", "C"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
WHILE NOT EOF("test.txt")
    READFILE "test.txt", line
    OUTPUT line
ENDWHILE
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["A", "B", "C"].join("\n"));
        });

        test("OPENFILE for APPEND adds to existing file", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "First"
CLOSEFILE "test.txt"

OPENFILE "test.txt" FOR APPEND
WRITEFILE "test.txt", "Second"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
WHILE NOT EOF("test.txt")
    READFILE "test.txt", line
    OUTPUT line
ENDWHILE
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["First", "Second"].join("\n"));
        });

        test("WRITE mode overwrites existing file", async () => {
            const { result, output } = await execute(`
OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "Old1"
WRITEFILE "test.txt", "Old2"
CLOSEFILE "test.txt"

OPENFILE "test.txt" FOR WRITE
WRITEFILE "test.txt", "New1"
CLOSEFILE "test.txt"

DECLARE line : STRING
OPENFILE "test.txt" FOR READ
WHILE NOT EOF("test.txt")
    READFILE "test.txt", line
    OUTPUT line
ENDWHILE
CLOSEFILE "test.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("New1");
        });

        test("copy file replacing blank lines", async () => {
            const { result, output } = await execute(`
OPENFILE "FileA.txt" FOR WRITE
WRITEFILE "FileA.txt", "Hello"
WRITEFILE "FileA.txt", ""
WRITEFILE "FileA.txt", "World"
CLOSEFILE "FileA.txt"

DECLARE LineOfText : STRING
OPENFILE "FileA.txt" FOR READ
OPENFILE "FileB.txt" FOR WRITE
WHILE NOT EOF("FileA.txt")
    READFILE "FileA.txt", LineOfText
    IF LineOfText = "" THEN
        WRITEFILE "FileB.txt", "------------------------------"
    ELSE
        WRITEFILE "FileB.txt", LineOfText
    ENDIF
ENDWHILE
CLOSEFILE "FileA.txt"
CLOSEFILE "FileB.txt"

OPENFILE "FileB.txt" FOR READ
WHILE NOT EOF("FileB.txt")
    READFILE "FileB.txt", LineOfText
    OUTPUT LineOfText
ENDWHILE
CLOSEFILE "FileB.txt"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Hello", "------------------------------", "World"].join("\n"));
        });
    });

    describe("9.2 Handling random files", () => {
        test("OPENFILE for RANDOM, SEEK, GETRECORD, PUTRECORD", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord

OPENFILE "StudentFile.Dat" FOR RANDOM
Pupil.LastName <- "Ali"
Pupil.YearGroup <- 5
SEEK "StudentFile.Dat", 1
PUTRECORD "StudentFile.Dat", Pupil

Pupil.LastName <- "Bob"
Pupil.YearGroup <- 6
SEEK "StudentFile.Dat", 2
PUTRECORD "StudentFile.Dat", Pupil

SEEK "StudentFile.Dat", 1
GETRECORD "StudentFile.Dat", Pupil
OUTPUT Pupil.LastName
OUTPUT Pupil.YearGroup

SEEK "StudentFile.Dat", 2
GETRECORD "StudentFile.Dat", Pupil
OUTPUT Pupil.LastName
OUTPUT Pupil.YearGroup

CLOSEFILE "StudentFile.Dat"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "5", "Bob", "6"].join("\n"));
        });

        test("PUTRECORD overwrites existing record", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord

OPENFILE "StudentFile.Dat" FOR RANDOM
Pupil.LastName <- "Old"
Pupil.YearGroup <- 1
SEEK "StudentFile.Dat", 1
PUTRECORD "StudentFile.Dat", Pupil

Pupil.LastName <- "New"
Pupil.YearGroup <- 2
SEEK "StudentFile.Dat", 1
PUTRECORD "StudentFile.Dat", Pupil

SEEK "StudentFile.Dat", 1
GETRECORD "StudentFile.Dat", Pupil
OUTPUT Pupil.LastName

CLOSEFILE "StudentFile.Dat"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("New");
        });

        test("move records using FOR loop with STEP -1", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord
DECLARE NewPupil : StudentRecord
DECLARE Position : INTEGER

NewPupil.LastName <- "Johnson"
NewPupil.YearGroup <- 6

OPENFILE "StudentFile.Dat" FOR RANDOM
Pupil.LastName <- "A"
Pupil.YearGroup <- 1
SEEK "StudentFile.Dat", 10
PUTRECORD "StudentFile.Dat", Pupil
Pupil.LastName <- "B"
Pupil.YearGroup <- 2
SEEK "StudentFile.Dat", 11
PUTRECORD "StudentFile.Dat", Pupil

FOR Position <- 11 TO 11 STEP -1
    SEEK "StudentFile.Dat", Position
    GETRECORD "StudentFile.Dat", Pupil
    SEEK "StudentFile.Dat", Position + 1
    PUTRECORD "StudentFile.Dat", Pupil
NEXT Position

SEEK "StudentFile.Dat", 10
PUTRECORD "StudentFile.Dat", NewPupil

SEEK "StudentFile.Dat", 10
GETRECORD "StudentFile.Dat", Pupil
OUTPUT Pupil.LastName
OUTPUT Pupil.YearGroup

SEEK "StudentFile.Dat", 12
GETRECORD "StudentFile.Dat", Pupil
OUTPUT Pupil.LastName

CLOSEFILE "StudentFile.Dat"
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Johnson", "6", "B"].join("\n"));
        });
    });
});
