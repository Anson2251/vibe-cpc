import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("User-defined data types (CPC 4.1-4.2)", () => {
    describe("4.1 Enumerated type", () => {
        test("declare and assign enum value", async () => {
            const { result, output } = await execute(`
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason <- Summer
OUTPUT ThisSeason
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Summer");
        });

        test("enum values are distinct", async () => {
            const { result, output } = await execute(`
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE s1 : Season
DECLARE s2 : Season
s1 <- Spring
s2 <- Winter
OUTPUT s1
OUTPUT s2
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Spring", "Winter"].join("\n"));
        });

        test("rejects invalid enum value assignment", async () => {
            const { result } = await execute(`
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason <- Monsoon
`);
            expect(result.success).toBe(false);
        });

        test("enum comparison with equality", async () => {
            const { result, output } = await execute(`
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE s : Season
s <- Summer
IF s = Summer THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });
    });

    describe("4.1 Pointer type", () => {
        test("declare pointer type with ^ syntax", async () => {
            const { result, output } = await execute(`
TYPE TIntPointer = ^INTEGER
DECLARE MyPointer : TIntPointer
OUTPUT "ok"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("ok");
        });

        test("assign NULL to pointer", async () => {
            const { result, output } = await execute(`
TYPE TIntPointer = ^INTEGER
DECLARE MyPointer : TIntPointer
MyPointer <- NULL
IF MyPointer = NULL THEN
    OUTPUT "null"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("null");
        });

        test("address-of with ^ and dereference with p^", async () => {
            const { result, output } = await execute(`
TYPE IntPtr = ^INTEGER
DECLARE x : INTEGER
DECLARE p : IntPtr
x <- 42
p <- ^x
OUTPUT p^
`);
            expect(result.success).toBe(true);
            expect(output).toBe("42");
        });

        test("null pointer dereference reports error", async () => {
            const { result } = await execute(`
TYPE IntPtr = ^INTEGER
DECLARE p : IntPtr
p <- NULL
OUTPUT p^
`);
            expect(result.success).toBe(false);
        });

        test("pointer to record type", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE Name : STRING
    DECLARE Age : INTEGER
ENDTYPE

TYPE StudentPtr = ^StudentRecord
DECLARE s : StudentRecord
s.Name <- "Alice"
s.Age <- 20
DECLARE p : StudentPtr
p <- ^s
OUTPUT p^.Name
OUTPUT p^.Age
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Alice", "20"].join("\n"));
        });

        test("modify value through pointer dereference", async () => {
            const { result, output } = await execute(`
TYPE IntPtr = ^INTEGER
DECLARE x : INTEGER
DECLARE p : IntPtr
x <- 10
p <- ^x
p^ <- 99
OUTPUT x
`);
            expect(result.success).toBe(true);
            expect(output).toBe("99");
        });

        test("DISPOSE statement", async () => {
            const { result, output } = await execute(`
TYPE IntPtr = ^INTEGER
DECLARE x : INTEGER
DECLARE p : IntPtr
x <- 42
p <- ^x
DISPOSE p
OUTPUT "disposed"
`);
            expect(result.success).toBe(true);
            expect(output).toBe("disposed");
        });
    });

    describe("4.1 Record type", () => {
        test("declare and use record type", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord
Pupil.LastName <- "Johnson"
Pupil.YearGroup <- 6
OUTPUT Pupil.LastName
OUTPUT Pupil.YearGroup
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Johnson", "6"].join("\n"));
        });

        test("record whole assignment", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil1 : StudentRecord
DECLARE Pupil2 : StudentRecord
Pupil1.LastName <- "Johnson"
Pupil1.YearGroup <- 6
Pupil2 <- Pupil1
OUTPUT Pupil2.LastName
OUTPUT Pupil2.YearGroup
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Johnson", "6"].join("\n"));
        });

        test("record whole assignment creates independent copy", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil1 : StudentRecord
DECLARE Pupil2 : StudentRecord
Pupil1.LastName <- "Johnson"
Pupil1.YearGroup <- 6
Pupil2 <- Pupil1
Pupil2.LastName <- "Smith"
OUTPUT Pupil1.LastName
OUTPUT Pupil2.LastName
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Johnson", "Smith"].join("\n"));
        });

        test("nested record type", async () => {
            const { result, output } = await execute(`
TYPE AddressRecord
    DECLARE HouseNumber : INTEGER
ENDTYPE

TYPE StudentRecord
    DECLARE Name : STRING
    DECLARE Address : AddressRecord
ENDTYPE

DECLARE Pupil : StudentRecord
Pupil.Name <- "Ali"
Pupil.Address.HouseNumber <- 12
OUTPUT Pupil.Name
OUTPUT Pupil.Address.HouseNumber
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "12"].join("\n"));
        });

        test("array of records", async () => {
            const { result, output } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Form : ARRAY[1:2] OF StudentRecord
Form[1].LastName <- "Ali"
Form[1].YearGroup <- 5
Form[2].LastName <- "Bob"
Form[2].YearGroup <- 6
OUTPUT Form[1].LastName
OUTPUT Form[2].YearGroup
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Ali", "6"].join("\n"));
        });

        test("rejects unknown field access", async () => {
            const { result } = await execute(`
TYPE StudentRecord
    DECLARE LastName : STRING
ENDTYPE

DECLARE Pupil : StudentRecord
Pupil.DoesNotExist <- "X"
`);
            expect(result.success).toBe(false);
        });

        test("rejects wrong type field assignment", async () => {
            const { result } = await execute(`
TYPE StudentRecord
    DECLARE YearGroup : INTEGER
ENDTYPE

DECLARE Pupil : StudentRecord
Pupil.YearGroup <- "Six"
`);
            expect(result.success).toBe(false);
        });
    });

    describe("4.1 Set type", () => {
        test("declare set type and assign with bracket literal", async () => {
            const { result, output } = await execute(`
TYPE TLetterSet = SET OF CHAR
DECLARE Vowels : TLetterSet
Vowels <- ['A', 'E', 'I', 'O', 'U']
IF 'E' IN Vowels THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("IN returns false for non-member", async () => {
            const { result, output } = await execute(`
TYPE TLetterSet = SET OF CHAR
DECLARE Vowels : TLetterSet
Vowels <- ['A', 'E', 'I', 'O', 'U']
IF 'Z' IN Vowels THEN
    OUTPUT "yes"
ELSE
    OUTPUT "no"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("no");
        });

        test("DEFINE set constant", async () => {
            const { result, output } = await execute(`
TYPE LetterSet = SET OF CHAR
DEFINE Vowels('A','E','I','O','U') : LetterSet
IF 'A' IN Vowels THEN
    OUTPUT "yes"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("yes");
        });

        test("set of INTEGER type", async () => {
            const { result, output } = await execute(`
TYPE TScoreSet = SET OF INTEGER
DECLARE PrimeScores : TScoreSet
PrimeScores <- [2, 3, 5, 7, 11]
IF 7 IN PrimeScores THEN
    OUTPUT "prime"
ENDIF
`);
            expect(result.success).toBe(true);
            expect(output).toBe("prime");
        });

        test("rejects wrong element type in set", async () => {
            const { result } = await execute(`
TYPE LetterSet = SET OF CHAR
DEFINE Vowels('A', 1) : LetterSet
`);
            expect(result.success).toBe(false);
        });
    });
});
