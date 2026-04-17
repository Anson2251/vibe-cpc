import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: Data Structures", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("Set support", () => {
        test("should support set assignment using bracket literals", async () => {
            const code = `
        TYPE TLetterSet = SET OF CHAR
        TYPE TScoreSet = SET OF INTEGER

        DECLARE Vowels : TLetterSet
        DECLARE PrimeScores : TScoreSet

        Vowels <- ['A', 'E', 'I', 'O', 'U']
        PrimeScores <- [2, 3, 5, 7, 11]

        IF 'E' IN Vowels THEN
          OUTPUT "VOWEL_OK"
        ELSE
          OUTPUT "VOWEL_BAD"
        ENDIF

        IF 7 IN PrimeScores THEN
          OUTPUT "PRIME_OK"
        ELSE
          OUTPUT "PRIME_BAD"
        ENDIF

        IF 4 IN PrimeScores THEN
          OUTPUT "NOT_EXPECTED"
        ELSE
          OUTPUT "NOT_PRIME_OK"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["VOWEL_OK", "PRIME_OK", "NOT_PRIME_OK"]);
        });

        test("should support DEFINE set and IN membership", async () => {
            const code = `
        TYPE LetterSet = SET OF CHAR
        DEFINE Vowels ('A','E','I','O','U') : LetterSet

        IF 'E' IN Vowels THEN
          OUTPUT "YES"
        ELSE
          OUTPUT "NO"
        ENDIF

        IF 'Z' IN Vowels THEN
          OUTPUT "YES"
        ELSE
          OUTPUT "NO"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["YES", "NO"]);
        });

        test("should reject invalid set element types", async () => {
            const code = `
        TYPE LetterSet = SET OF CHAR
        DEFINE Vowels ('A', 1) : LetterSet
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Expected CHAR");
        });
    });

    describe("Array enhancements", () => {
        test("should support integer variables as array bounds", async () => {
            const code = `
        DECLARE n : INTEGER
        DECLARE i : INTEGER
        n <- 3
        DECLARE values : ARRAY[1:n] OF INTEGER

        FOR i <- 1 TO n
          values[i] <- i * 10
        NEXT i

        FOR i <- 1 TO n
          OUTPUT values[i]
        NEXT i
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["10", "20", "30"]);
        });

        test("should support arrays of user defined records and chained member access", async () => {
            const code = `
        TYPE SeatPos
          DECLARE Row : INTEGER
          DECLARE Col : INTEGER
        ENDTYPE

        DECLARE n : INTEGER
        DECLARE i : INTEGER
        DECLARE SeatPoses : ARRAY[1:2] OF SeatPos
        n <- 2

        FOR i <- 1 TO n
          SeatPoses[i].Row <- i
          SeatPoses[i].Col <- i + 10
        NEXT i

        OUTPUT SeatPoses[1].Row
        OUTPUT SeatPoses[1].Col
        OUTPUT SeatPoses[2].Row
        OUTPUT SeatPoses[2].Col
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "11", "2", "12"]);
        });
    });

    describe("Arrays", () => {
        test("should handle array declarations and access", async () => {
            const code = `
        DECLARE numbers : ARRAY[1:5] OF INTEGER
        DECLARE i : INTEGER
        FOR i <- 1 TO 5
          numbers[i] <- i * 10
        NEXT i
        FOR i <- 1 TO 5
          OUTPUT numbers[i]
        NEXT i
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["10", "20", "30", "40", "50"]);
        });

        test("should handle two-dimensional arrays", async () => {
            const code = `
        DECLARE matrix : ARRAY[1:2, 1:2] OF INTEGER
        matrix[1, 1] <- 1
        matrix[1, 2] <- 2
        matrix[2, 1] <- 3
        matrix[2, 2] <- 4
        OUTPUT matrix[1, 1]
        OUTPUT matrix[1, 2]
        OUTPUT matrix[2, 1]
        OUTPUT matrix[2, 2]
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "2", "3", "4"]);
        });

        test("should reject out-of-bounds array access with readable error", async () => {
            const code = `
        DECLARE numbers : ARRAY[1:2] OF INTEGER
        numbers[1] <- 10
        OUTPUT numbers[3]
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Array index out of bounds");
        });

        test("should reject assigning wrong type into integer array", async () => {
            const code = `
        DECLARE numbers : ARRAY[1:2] OF INTEGER
        numbers[1] <- "abc"
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Expected INTEGER");
        });

        test("should reject non-integer array index with readable error", async () => {
            const code = `
        DECLARE numbers : ARRAY[1:2] OF INTEGER
        numbers[1.5] <- 7
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Array index must be INTEGER");
        });
    });

    describe("User-defined types", () => {
        test("should support record type declaration and field assignment", async () => {
            const code = `
        TYPE StudentRecord
          DECLARE LastName : STRING
          DECLARE YearGroup : INTEGER
        ENDTYPE

        DECLARE Pupil : StudentRecord
        Pupil.LastName <- "Johnson"
        Pupil.YearGroup <- 6
        OUTPUT Pupil.LastName
        OUTPUT Pupil.YearGroup
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Johnson", "6"]);
        });

        test("should reject invalid field assignment type with readable error", async () => {
            const code = `
        TYPE StudentRecord
          DECLARE LastName : STRING
          DECLARE YearGroup : INTEGER
        ENDTYPE

        DECLARE Pupil : StudentRecord
        Pupil.YearGroup <- "Six"
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Expected INTEGER");
        });

        test("should reject unknown record field with readable error", async () => {
            const code = `
        TYPE StudentRecord
          DECLARE LastName : STRING
        ENDTYPE

        DECLARE Pupil : StudentRecord
        Pupil.DoesNotExist <- "X"
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown field 'DoesNotExist'");
        });

        test("should reject unknown user-defined type with readable error", async () => {
            const code = `
        DECLARE Pupil : MissingRecord
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown type 'MissingRecord'");
        });

        test("should support nested user-defined type member access and assignment", async () => {
            const code = `
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
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Ali", "12"]);
        });

        test("should reject unknown nested field with readable error", async () => {
            const code = `
        TYPE AddressRecord
          DECLARE HouseNumber : INTEGER
        ENDTYPE

        TYPE StudentRecord
          DECLARE Address : AddressRecord
        ENDTYPE

        DECLARE Pupil : StudentRecord
        Pupil.Address.Zip <- 12345
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown field 'Zip'");
        });
    });

    describe("BYREF semantics", () => {
        test("should propagate BYREF scalar updates back to caller", async () => {
            const code = `
        PROCEDURE Increment(BYREF Value : INTEGER)
          Value <- Value + 1
        ENDPROCEDURE

        DECLARE X : INTEGER
        X <- 10
        CALL Increment(X)
        OUTPUT X
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "11");
        });

        test("should reject BYREF call with non-variable argument", async () => {
            const code = `
        PROCEDURE Increment(BYREF Value : INTEGER)
          Value <- Value + 1
        ENDPROCEDURE

        CALL Increment(10)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "requires a variable, array element, or record field argument");
        });

        test("should propagate BYREF user-defined type updates back to caller", async () => {
            const code = `
        TYPE StudentRecord
          DECLARE YearGroup : INTEGER
        ENDTYPE

        PROCEDURE Promote(BYREF Pupil : StudentRecord)
          Pupil.YearGroup <- Pupil.YearGroup + 1
        ENDPROCEDURE

        DECLARE S : StudentRecord
        S.YearGroup <- 5
        CALL Promote(S)
        OUTPUT S.YearGroup
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "6");
        });
    });

    describe("Enum and Set types", () => {
        test("should support enum declaration and assignment", async () => {
            const code = `
        TYPE Season = (Spring, Summer, Autumn, Winter)
        DECLARE Current : Season
        Current <- Summer
        OUTPUT Current
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Summer");
        });

        test("should reject invalid enum assignment with readable error", async () => {
            const code = `
        TYPE Season = (Spring, Summer, Autumn, Winter)
        DECLARE Current : Season
        Current <- Monsoon
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Expected enum 'Season' value");
        });

        test("should support set declaration and IN operator", async () => {
            const code = `
        TYPE LetterSet = SET OF CHAR
        DEFINE Vowels('A','E','I','O','U') : LetterSet
        IF 'A' IN Vowels THEN
          OUTPUT "yes"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "yes");
        });

        test("should reject unknown set type in DEFINE", async () => {
            const code = `
        DEFINE Vowels('A','E','I') : MissingSet
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown set type 'MissingSet'");
        });

        test("should reject wrong element type in set values", async () => {
            const code = `
        TYPE LetterSet = SET OF CHAR
        DEFINE Vowels('A', 2) : LetterSet
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Expected CHAR");
        });
    });

    describe("BYREF semantics (heap-based)", () => {
        test("should propagate BYREF scalar updates back to caller", async () => {
            const code = `
        PROCEDURE Increment(BYREF Value : INTEGER)
          Value <- Value + 1
        ENDPROCEDURE

        DECLARE X : INTEGER
        X <- 10
        CALL Increment(X)
        OUTPUT X
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "11");
        });

        test("should propagate BYREF changes through multiple calls", async () => {
            const code = `
        PROCEDURE Add(BYREF Total : INTEGER, Value : INTEGER)
          Total <- Total + Value
        ENDPROCEDURE

        DECLARE Sum : INTEGER
        Sum <- 0
        CALL Add(Sum, 5)
        CALL Add(Sum, 3)
        CALL Add(Sum, 2)
        OUTPUT Sum
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "10");
        });

        test("should not affect caller with BYVAL parameters", async () => {
            const code = `
        PROCEDURE TryModify(BYVAL Value : INTEGER)
          Value <- 999
        ENDPROCEDURE

        DECLARE X : INTEGER
        X <- 42
        CALL TryModify(X)
        OUTPUT X
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "42");
        });

        test("should reject BYREF call with non-variable argument", async () => {
            const code = `
        PROCEDURE Increment(BYREF Value : INTEGER)
          Value <- Value + 1
        ENDPROCEDURE

        CALL Increment(10)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "requires a variable, array element, or record field argument");
        });

        test("BYREF should work with function calls too", async () => {
            const code = `
        PROCEDURE Swap(BYREF A : INTEGER, BYREF B : INTEGER)
          DECLARE Temp : INTEGER
          Temp <- A
          A <- B
          B <- Temp
        ENDPROCEDURE

        DECLARE X : INTEGER
        DECLARE Y : INTEGER
        X <- 1
        Y <- 2
        CALL Swap(X, Y)
        OUTPUT X
        OUTPUT Y
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["2", "1"]);
        });
    });
});
