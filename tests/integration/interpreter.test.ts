import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Interpreter Integration Tests", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("Basic programs", () => {
        test("should execute hello world program", async () => {
            const code = `
        DECLARE message : STRING
        message <- "Hello, World!"
        OUTPUT message
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Hello, World!");
        });

        test("should execute arithmetic operations", async () => {
            const code = `
        DECLARE a : INTEGER
        DECLARE b : INTEGER
        DECLARE result : INTEGER
        a <- 10
        b <- 5
        result <- a + b
        OUTPUT result
        result <- a - b
        OUTPUT result
        result <- a * b
        OUTPUT result
        result <- a DIV b
        OUTPUT result
        result <- a MOD b
        OUTPUT result
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["15", "5", "50", "2", "0"]);
        });

        test("should handle real number arithmetic", async () => {
            const code = `
        DECLARE x : REAL
        DECLARE y : REAL
        x <- 3.1
        y <- 2.0
        OUTPUT x + y
        OUTPUT x - y
        OUTPUT x * y
        OUTPUT x / y
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5.1", "1.1", "6.2", "1.55"]);
        });

        test("should handle string operations", async () => {
            const code = `
        DECLARE str1 : STRING
        DECLARE str2 : STRING
        DECLARE result : STRING
        str1 <- "Hello"
        str2 <- "World"
        result <- str1 & " " & str2
        OUTPUT result
        OUTPUT LENGTH(result)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Hello World", "11"]);
        });
    });

    describe("Built-in functions", () => {
        test("should execute string, numeric and date built-ins", async () => {
            const code = `
        DECLARE s : STRING
        DECLARE n : REAL
        DECLARE d : DATE
        DECLARE r : REAL

        s <- "AbC123"
        OUTPUT LEFT(s, 3)
        OUTPUT RIGHT(s, 3)
        OUTPUT MID(s, 2, 3)
        OUTPUT TO_UPPER("jim 803")
        OUTPUT TO_LOWER("JIM 803")
        OUTPUT LCASE('W')
        OUTPUT UCASE('h')
        OUTPUT NUM_TO_STR(-12.5)
        n <- STR_TO_NUM("23.45")
        OUTPUT n
        OUTPUT IS_NUM("123.0")
        OUTPUT IS_NUM("12x")
        OUTPUT ASC('A')
        OUTPUT CHR(66)
        OUTPUT INT(27.5415)

        d <- SETDATE(15, 6, 2024)
        OUTPUT DAY(d)
        OUTPUT MONTH(d)
        OUTPUT YEAR(d)
        OUTPUT DAYINDEX(d)

        r <- RAND(10)
        IF r >= 0 AND r < 10 THEN
          OUTPUT "RAND_OK"
        ELSE
          OUTPUT "RAND_BAD"
        ENDIF

        IF YEAR(TODAY()) >= 2000 THEN
          OUTPUT "TODAY_OK"
        ELSE
          OUTPUT "TODAY_BAD"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, [
                "AbC",
                "123",
                "bC1",
                "JIM 803",
                "jim 803",
                "w",
                "H",
                "-12.5",
                "23.45",
                "true",
                "false",
                "65",
                "B",
                "27",
                "15",
                "6",
                "2024",
                "7",
                "RAND_OK",
                "TODAY_OK",
            ]);
        });

        test("should fail invalid built-in parameters", async () => {
            const code = `
        OUTPUT CHR(999)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "CHR expects an integer between 0 and 127");
        });
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
            if (!result.success) {
                console.log("ERROR:", result.error);
                console.log("OUTPUT:", result.output);
            }
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
        DECLARE rec : STRING
        OPENFILE "records.dat" FOR RANDOM
        SEEK "records.dat", 0
        PUTRECORD "records.dat", "First"
        SEEK "records.dat", 1
        PUTRECORD "records.dat", "Second"
        SEEK "records.dat", 1
        GETRECORD "records.dat", rec
        OUTPUT rec
        CLOSEFILE "records.dat"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Second");
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

    // describe('Error handling', () => {
    // 	test('should handle division by zero', async () => {
    // 		const code = `
    //     DECLARE x : INTEGER
    //     DECLARE y : INTEGER
    //     DECLARE result : INTEGER
    //     x <- 10
    //     y <- 0
    //     result <- x / y
    //     OUTPUT result
    //   `;

    // 		const result = await testRunner.runCode(code);
    // 		expectError(result, 'division by zero');
    // 	});

    // 	test('should handle undefined variables', async () => {
    // 		const code = `
    //     OUTPUT undefinedVariable
    //   `;

    // 		const result = await testRunner.runCode(code);
    // 		expectError(result, 'undefined');
    // 	});

    // 	test('should handle type mismatches', async () => {
    // 		const code = `
    //     DECLARE x : INTEGER
    //     DECLARE y : STRING
    //     x <- 10
    //     y <- "hello"
    //     OUTPUT x + y
    //   `;

    // 		const result = await testRunner.runCode(code);
    // 		expectError(result, 'type');
    // });
    // });

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

    describe("Pointer types", () => {
        test("should declare pointer type with ^ syntax", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE p : IntPtr
        OUTPUT "ok"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "ok");
        });

        test("should support NULL pointer", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE p : IntPtr
        p <- NULL
        OUTPUT "null assigned"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "null assigned");
        });

        test("should dereference pointer with p^", async () => {
            const code = `
        DECLARE x : INTEGER
        x <- 42
        TYPE IntPtr = ^INTEGER
        DECLARE p : IntPtr
        p <- ^x
        OUTPUT p^
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "42");
        });

        test("should throw on null pointer dereference", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE p : IntPtr
        p <- NULL
        OUTPUT p^
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "Null pointer dereference");
        });

        test("should support DISPOSE statement", async () => {
            const code = `
        DECLARE x : INTEGER
        x <- 42
        TYPE IntPtr = ^INTEGER
        DECLARE p : IntPtr
        p <- ^x
        DISPOSE p
        OUTPUT "disposed"
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "disposed");
        });

        test("should support pointer to record type", async () => {
            const code = `
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
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Alice", "20"]);
        });
    });

    describe("Pointer real-world patterns", () => {
        test("should modify record through pointer dereference", async () => {
            const code = `
        TYPE Point
          DECLARE X : INTEGER
          DECLARE Y : INTEGER
        ENDTYPE

        TYPE PointPtr = ^Point
        DECLARE pt : Point
        pt.X <- 3
        pt.Y <- 4
        DECLARE p : PointPtr
        p <- ^pt
        p^.X <- 10
        p^.Y <- 20
        OUTPUT pt.X
        OUTPUT pt.Y
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["10", "20"]);
        });

        test("should store pointers in an array and dereference them", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE a : INTEGER
        DECLARE b : INTEGER
        DECLARE c : INTEGER
        a <- 10
        b <- 20
        c <- 30
        DECLARE ptrs : ARRAY[1:3] OF IntPtr
        ptrs[1] <- ^a
        ptrs[2] <- ^b
        ptrs[3] <- ^c
        OUTPUT ptrs[1]^
        OUTPUT ptrs[2]^
        OUTPUT ptrs[3]^
      `;

            const result = await testRunner.runCode(code);
            if (!result.success) console.log("ERROR:", result.error, "OUTPUT:", result.output);
            expectOutput(result, ["10", "20", "30"]);
        });

        test("should modify original variable through array-stored pointer", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE x : INTEGER
        x <- 5
        DECLARE ptrs : ARRAY[1:2] OF IntPtr
        ptrs[1] <- ^x
        ptrs[1]^ <- 99
        OUTPUT x
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "99");
        });

        test("should handle multiple pointers to the same variable (aliasing)", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE val : INTEGER
        val <- 42
        DECLARE p1 : IntPtr
        DECLARE p2 : IntPtr
        p1 <- ^val
        p2 <- ^val
        p1^ <- 100
        OUTPUT p2^
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "100");
        });

        test("should reassign pointer to point to different variable", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE a : INTEGER
        DECLARE b : INTEGER
        a <- 10
        b <- 20
        DECLARE p : IntPtr
        p <- ^a
        OUTPUT p^
        p <- ^b
        OUTPUT p^
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["10", "20"]);
        });

        test("should pass array element by BYREF", async () => {
            const code = `
        PROCEDURE Double(BYREF Val : INTEGER)
          Val <- Val * 2
        ENDPROCEDURE

        DECLARE nums : ARRAY[1:3] OF INTEGER
        nums[1] <- 5
        nums[2] <- 10
        nums[3] <- 15
        CALL Double(nums[2])
        OUTPUT nums[1]
        OUTPUT nums[2]
        OUTPUT nums[3]
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "20", "15"]);
        });

        test("should swap two records using BYREF", async () => {
            const code = `
        TYPE Student
          DECLARE Name : STRING
          DECLARE Grade : INTEGER
        ENDTYPE

        PROCEDURE SwapStudent(BYREF A : Student, BYREF B : Student)
          DECLARE Temp : Student
          Temp <- A
          A <- B
          B <- Temp
        ENDPROCEDURE

        DECLARE s1 : Student
        DECLARE s2 : Student
        s1.Name <- "Alice"
        s1.Grade <- 90
        s2.Name <- "Bob"
        s2.Grade <- 85
        CALL SwapStudent(s1, s2)
        OUTPUT s1.Name
        OUTPUT s1.Grade
        OUTPUT s2.Name
        OUTPUT s2.Grade
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Bob", "85", "Alice", "90"]);
        });

        test("should use BYREF to accumulate values in a loop", async () => {
            const code = `
        PROCEDURE AddToTotal(BYREF Total : INTEGER, Value : INTEGER)
          Total <- Total + Value
        ENDPROCEDURE

        DECLARE sum : INTEGER
        DECLARE i : INTEGER
        sum <- 0
        FOR i <- 1 TO 5
          CALL AddToTotal(sum, i)
        NEXT i
        OUTPUT sum
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "15");
        });

        test("should access record array through pointer", async () => {
            const code = `
        TYPE Item
          DECLARE Name : STRING
          DECLARE Price : REAL
        ENDTYPE

        TYPE ItemPtr = ^Item
        DECLARE inventory : ARRAY[1:3] OF Item
        inventory[1].Name <- "Pen"
        inventory[1].Price <- 1.5
        inventory[2].Name <- "Book"
        inventory[2].Price <- 9.99
        inventory[3].Name <- "Bag"
        inventory[3].Price <- 25.0
        DECLARE p : ItemPtr
        p <- ^inventory[2]
        OUTPUT p^.Name
        OUTPUT p^.Price
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Book", "9.99"]);
        });

        test("should modify record array element through pointer", async () => {
            const code = `
        TYPE Item
          DECLARE Name : STRING
          DECLARE Qty : INTEGER
        ENDTYPE

        TYPE ItemPtr = ^Item
        DECLARE stock : ARRAY[1:2] OF Item
        stock[1].Name <- "Pen"
        stock[1].Qty <- 10
        stock[2].Name <- "Book"
        stock[2].Qty <- 5
        DECLARE p : ItemPtr
        p <- ^stock[1]
        p^.Qty <- 100
        OUTPUT stock[1].Qty
        OUTPUT stock[2].Qty
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["100", "5"]);
        });

        test("should use BYREF to find min and max in one pass", async () => {
            const code = `
        PROCEDURE UpdateMinMax(BYREF Min : INTEGER, BYREF Max : INTEGER, Val : INTEGER)
          IF Val < Min THEN
            Min <- Val
          ENDIF
          IF Val > Max THEN
            Max <- Val
          ENDIF
        ENDPROCEDURE

        DECLARE minVal : INTEGER
        DECLARE maxVal : INTEGER
        DECLARE nums : ARRAY[1:5] OF INTEGER
        nums[1] <- 34
        nums[2] <- 12
        nums[3] <- 89
        nums[4] <- 5
        nums[5] <- 67
        DECLARE i : INTEGER
        minVal <- nums[1]
        maxVal <- nums[1]
        FOR i <- 2 TO 5
          CALL UpdateMinMax(minVal, maxVal, nums[i])
        NEXT i
        OUTPUT minVal
        OUTPUT maxVal
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "89"]);
        });

        test("should use pointer to CHAR and dereference", async () => {
            const code = `
        TYPE CharPtr = ^CHAR
        DECLARE ch : CHAR
        ch <- 'A'
        DECLARE p : CharPtr
        p <- ^ch
        OUTPUT p^
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "A");
        });

        test("should pass pointer variable to BYREF parameter", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        PROCEDURE SetToZero(BYREF Val : INTEGER)
          Val <- 0
        ENDPROCEDURE

        DECLARE x : INTEGER
        x <- 42
        DECLARE p : IntPtr
        p <- ^x
        CALL SetToZero(x)
        OUTPUT p^
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "0");
        });

        test("should handle BYREF with nested record field", async () => {
            const code = `
        TYPE Address
          DECLARE City : STRING
          DECLARE Zip : STRING
        ENDTYPE

        TYPE Person
          DECLARE Name : STRING
          DECLARE Home : Address
        ENDTYPE

        PROCEDURE UpdateZip(BYREF Zip : STRING, NewZip : STRING)
          Zip <- NewZip
        ENDPROCEDURE

        DECLARE p : Person
        p.Name <- "Alice"
        p.Home.City <- "NYC"
        p.Home.Zip <- "10001"
        CALL UpdateZip(p.Home.Zip, "90210")
        OUTPUT p.Home.City
        OUTPUT p.Home.Zip
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["NYC", "90210"]);
        });

        test("should iterate over array using pointer arithmetic pattern", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE values : ARRAY[1:4] OF INTEGER
        values[1] <- 10
        values[2] <- 20
        values[3] <- 30
        values[4] <- 40
        DECLARE total : INTEGER
        DECLARE i : INTEGER
        DECLARE p : IntPtr
        total <- 0
        FOR i <- 1 TO 4
          p <- ^values[i]
          total <- total + p^
        NEXT i
        OUTPUT total
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "100");
        });

        test("should handle DISPOSE and verify pointer is cleared", async () => {
            const code = `
        TYPE IntPtr = ^INTEGER
        DECLARE x : INTEGER
        x <- 42
        DECLARE p : IntPtr
        p <- ^x
        OUTPUT p^
        DISPOSE p
        p <- NULL
        IF p = NULL THEN
          OUTPUT "null"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["42", "null"]);
        });

        test("should use BYREF to build a counter across procedure calls", async () => {
            const code = `
        PROCEDURE CountChar(BYREF Count : INTEGER, Str : STRING, Ch : CHAR)
          DECLARE i : INTEGER
          FOR i <- 1 TO LENGTH(Str)
            IF MID(Str, i, 1) = Ch THEN
              Count <- Count + 1
            ENDIF
          NEXT i
        ENDPROCEDURE

        DECLARE total : INTEGER
        total <- 0
        CALL CountChar(total, "hello world", 'l')
        CALL CountChar(total, "lucky llama", 'l')
        OUTPUT total
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "6");
        });

        test("should store pointers to records in array and access fields", async () => {
            const code = `
        TYPE Node
          DECLARE Value : INTEGER
          DECLARE Label : STRING
        ENDTYPE

        TYPE NodePtr = ^Node
        DECLARE n1 : Node
        DECLARE n2 : Node
        n1.Value <- 1
        n1.Label <- "first"
        n2.Value <- 2
        n2.Label <- "second"
        DECLARE nodes : ARRAY[1:2] OF NodePtr
        nodes[1] <- ^n1
        nodes[2] <- ^n2
        OUTPUT nodes[1]^.Value
        OUTPUT nodes[1]^.Label
        OUTPUT nodes[2]^.Value
        OUTPUT nodes[2]^.Label
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "first", "2", "second"]);
        });

        test("should modify record through pointer stored in array", async () => {
            const code = `
        TYPE Counter
          DECLARE Count : INTEGER
        ENDTYPE

        TYPE CounterPtr = ^Counter
        PROCEDURE Increment(BYREF C : Counter)
          C.Count <- C.Count + 1
        ENDPROCEDURE

        DECLARE c1 : Counter
        DECLARE c2 : Counter
        c1.Count <- 0
        c2.Count <- 0
        DECLARE ptrs : ARRAY[1:2] OF CounterPtr
        ptrs[1] <- ^c1
        ptrs[2] <- ^c2
        ptrs[1]^.Count <- 10
        ptrs[2]^.Count <- 20
        OUTPUT c1.Count
        OUTPUT c2.Count
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["10", "20"]);
        });
    });

    describe("CONSTANT declarations", () => {
        test("should declare and use an integer constant", async () => {
            const code = `
        CONSTANT MaxValue = 100
        DECLARE x : INTEGER
        x <- MaxValue
        OUTPUT x
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "100");
        });

        test("should declare and use a real constant", async () => {
            const code = `
        CONSTANT HourlyRate = 6.50
        DECLARE pay : REAL
        pay <- HourlyRate * 8
        OUTPUT pay
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "52");
        });

        test("should declare and use a string constant", async () => {
            const code = `
        CONSTANT DefaultText = "N/A"
        OUTPUT DefaultText
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "N/A");
        });

        test("should declare and use a boolean constant", async () => {
            const code = `
        CONSTANT Enabled = TRUE
        IF Enabled THEN
            OUTPUT "yes"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "yes");
        });

        test("parses IF with ELSE branch and nested statements", async () => {
            const code = `
            DECLARE x : INTEGER
            x <- 10
            DECLARE y : INTEGER
            y <- 5
            IF (
                (x > y)
                AND
                (x < 15)
            ) THEN
                OUTPUT "yes"
            ELSE
                OUTPUT "no"
            ENDIF
        `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "yes");
        });

        test("should prevent reassignment of a constant", async () => {
            const code = `
        CONSTANT Pi = 3
        Pi <- 4
      `;

            const result = await testRunner.runCode(code);
            expectError(result);
        });

        test("should use constant in expressions", async () => {
            const code = `
        CONSTANT Pi = 3
        DECLARE r : INTEGER
        DECLARE area : INTEGER
        r <- 5
        area <- Pi * r * r
        OUTPUT area
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "75");
        });

        test("should infer CHAR type from single-character string", async () => {
            const code = `
        CONSTANT Separator = ","
        OUTPUT Separator
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ",");
        });

        test("should allow multiple constants", async () => {
            const code = `
        CONSTANT Width = 10
        CONSTANT Height = 5
        DECLARE area : INTEGER
        area <- Width * Height
        OUTPUT area
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "50");
        });
    });

    describe("Extended built-in functions", () => {
        test("should execute POSITION to find substring", async () => {
            const code = `
        DECLARE pos : INTEGER
        pos <- POSITION("Hello World", "World")
        OUTPUT pos
        pos <- POSITION("Hello World", "xyz")
        OUTPUT pos
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["7", "0"]);
        });

        test("should execute ROUND, ABS, SQRT, POWER", async () => {
            const code = `
        OUTPUT ROUND(3.14159, 2)
        OUTPUT ABS(-4.7)
        OUTPUT SQRT(25)
        OUTPUT POWER(2, 10)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["3.14", "4.7", "5", "1024"]);
        });

        test("should execute REPLACE and TRIM", async () => {
            const code = `
        OUTPUT REPLACE("aabbcc", "b", "X")
        OUTPUT TRIM("  hello  ")
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["aaXXcc", "hello"]);
        });

        test("should reject SQRT of negative number", async () => {
            const code = `
        OUTPUT SQRT(-1)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "non-negative");
        });
    });

    describe("TYPEOF function", () => {
        test("should return type name for each primitive type", async () => {
            const code = `
        DECLARE i : INTEGER
        DECLARE r : REAL
        DECLARE s : STRING
        DECLARE c : CHAR
        DECLARE b : BOOLEAN
        DECLARE d : DATE

        i <- 42
        r <- 3.14
        s <- "hello"
        c <- 'A'
        b <- TRUE
        d <- SETDATE(1, 1, 2024)

        OUTPUT TYPEOF(i)
        OUTPUT TYPEOF(r)
        OUTPUT TYPEOF(s)
        OUTPUT TYPEOF(c)
        OUTPUT TYPEOF(b)
        OUTPUT TYPEOF(d)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["INTEGER", "REAL", "STRING", "CHAR", "BOOLEAN", "DATE"]);
        });

        test("should return type name for literal values", async () => {
            const code = `
        OUTPUT TYPEOF(42)
        OUTPUT TYPEOF(3.14)
        OUTPUT TYPEOF("hello")
        OUTPUT TYPEOF('A')
        OUTPUT TYPEOF(TRUE)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["INTEGER", "REAL", "STRING", "CHAR", "BOOLEAN"]);
        });

        test("should use TYPEOF in conditional logic", async () => {
            const code = `
        DECLARE x : INTEGER
        x <- 42
        IF TYPEOF(x) = "INTEGER" THEN
          OUTPUT "x is integer"
        ELSE
          OUTPUT "x is not integer"
        ENDIF
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "x is integer");
        });

        test("should distinguish INTEGER from REAL via TYPEOF", async () => {
            const code = `
        DECLARE i : INTEGER
        DECLARE r : REAL
        i <- 5
        r <- 5.0
        OUTPUT TYPEOF(i)
        OUTPUT TYPEOF(r)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["INTEGER", "REAL"]);
        });
    });

    describe("CAIE_ONLY mode", () => {
        test("should allow CAIE standard functions in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        DECLARE s : STRING
        s <- "Hello"
        OUTPUT LENGTH(s)
        OUTPUT LEFT(s, 3)
        OUTPUT TO_UPPER(s)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "Hel", "HELLO"]);
        });

        test("should block POSITION in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT POSITION("Hello", "l")
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block ROUND in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT ROUND(3.14, 1)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block TYPEOF in CAIE_ONLY mode", async () => {
            const code = `
        // CAIE_ONLY
        OUTPUT TYPEOF(42)
      `;

            const result = await testRunner.runCode(code);
            expectError(result, "not a CAIE standard function");
        });

        test("should block ABS, SQRT, POWER, REPLACE, TRIM in CAIE_ONLY mode", async () => {
            const codes = [
                "OUTPUT ABS(-1)",
                "OUTPUT SQRT(4)",
                "OUTPUT POWER(2, 3)",
                'OUTPUT REPLACE("abc", "b", "x")',
                'OUTPUT TRIM("  hi  ")',
            ];

            for (const expr of codes) {
                const code = `// CAIE_ONLY\n${expr}`;
                const result = await testRunner.runCode(code);
                expectError(result, "not a CAIE standard function");
            }
        });

        test("should allow extended functions without CAIE_ONLY", async () => {
            const code = `
        OUTPUT SQRT(25)
        OUTPUT TYPEOF(42)
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["5", "INTEGER"]);
        });

        test("should not detect CAIE_ONLY when comment is not on first line", async () => {
            const code = `
        OUTPUT SQRT(25)
        // CAIE_ONLY
      `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "5");
        });
    });

    describe("IMPORT and EXPORT", () => {
        test("should import and call exported function", async () => {
            testRunner.setFileContent(
                "mathlib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Multiply(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * B
ENDFUNCTION

EXPORT Add, Multiply
            `,
            );

            const code = `
IMPORT "mathlib"
OUTPUT Add(3, 4)
OUTPUT Multiply(2, 5)
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["7", "10"]);
        });

        test("should import with namespace using CONSTANT", async () => {
            testRunner.setFileContent(
                "mathlib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Multiply(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * B
ENDFUNCTION

EXPORT Add, Multiply
            `,
            );

            const code = `
CONSTANT math = IMPORT "mathlib"
OUTPUT math.Add(3, 4)
OUTPUT math.Multiply(2, 5)
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["7", "10"]);
        });

        test("should not import unexported declarations", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Visible() RETURNS STRING
    RETURN "visible"
ENDFUNCTION

FUNCTION Hidden() RETURNS STRING
    RETURN "hidden"
ENDFUNCTION

EXPORT Visible
            `,
            );

            const code = `
IMPORT "lib"
OUTPUT Visible()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "visible");
        });

        test("should not import anything when no EXPORT statement", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION
            `,
            );

            const code = `
IMPORT "lib"
OUTPUT Add(1, 2)
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "Add");
        });

        test("should block IMPORT in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
IMPORT "lib"
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "IMPORT is not a CAIE standard feature");
        });

        test("should block EXPORT in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
EXPORT Add
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "EXPORT is not a CAIE standard feature");
        });

        test("should block DEBUGGER in CAIE_ONLY mode", async () => {
            const code = `
// CAIE_ONLY
DECLARE x : INTEGER
DEBUGGER
x <- 5
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "DEBUGGER is not a CAIE standard feature");
        });

        test("should error on unknown namespace", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

EXPORT Add
            `,
            );

            const code = `
CONSTANT math = IMPORT "lib"
OUTPUT unknown.Add(1, 2)
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "Unknown namespace");
        });

        test("should error on unexported function in namespace", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Secret() RETURNS STRING
    RETURN "secret"
ENDFUNCTION

EXPORT Add
            `,
            );

            const code = `
CONSTANT math = IMPORT "lib"
OUTPUT math.Secret()
            `;

            const result = await testRunner.runCode(code);
            expectError(result, "is not exported from");
        });

        test("should export procedures", async () => {
            testRunner.setFileContent(
                "lib.cpc",
                `
PROCEDURE Greet(Name : STRING)
    OUTPUT "Hello, " & Name
ENDPROCEDURE

EXPORT Greet
            `,
            );

            const code = `
IMPORT "lib"
CALL Greet("World")
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Hello, World");
        });
    });

    describe("Object-Oriented Programming", () => {
        test("should create object with constructor and access property", async () => {
            const code = `
CLASS Pet
    PRIVATE Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
ENDCLASS

DECLARE MyPet : INTEGER
MyPet <- NEW Pet("Kitty")
OUTPUT MyPet.Name
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Kitty");
        });

        test("should call method on object", async () => {
            const code = `
CLASS Player
    PRIVATE Attempts : INTEGER
    PUBLIC PROCEDURE NEW()
        Attempts <- 3
    ENDPROCEDURE
    PUBLIC PROCEDURE SetAttempts(Number : INTEGER)
        Attempts <- Number
    ENDPROCEDURE
    PUBLIC FUNCTION GetAttempts() RETURNS INTEGER
        RETURN Attempts
    ENDFUNCTION
ENDCLASS

DECLARE p : INTEGER
p <- NEW Player()
OUTPUT p.GetAttempts()
p.SetAttempts(5)
OUTPUT p.GetAttempts()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["3", "5"]);
        });

        test("should support inheritance with SUPER.NEW", async () => {
            const code = `
CLASS Pet
    PRIVATE Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
ENDCLASS

CLASS Cat INHERITS Pet
    PRIVATE Breed : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
        SUPER.NEW(GivenName)
        Breed <- GivenBreed
    ENDPROCEDURE
ENDCLASS

DECLARE MyCat : INTEGER
MyCat <- NEW Cat("Kitty", "Shorthaired")
OUTPUT MyCat.Name
OUTPUT MyCat.Breed
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["Kitty", "Shorthaired"]);
        });

        test("should support method overriding in child class", async () => {
            const code = `
CLASS Animal
    PRIVATE Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
    PUBLIC PROCEDURE Speak()
        OUTPUT "..."
    ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
    PUBLIC PROCEDURE Speak()
        OUTPUT "Woof!"
    ENDPROCEDURE
ENDCLASS

DECLARE d : INTEGER
d <- NEW Dog("Rex")
d.Speak()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "Woof!");
        });

        test("should inherit parent methods not overridden", async () => {
            const code = `
CLASS Animal
    PRIVATE Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
    PUBLIC PROCEDURE Speak()
        OUTPUT "..."
    ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
    PUBLIC PROCEDURE Fetch()
        OUTPUT "Fetching!"
    ENDPROCEDURE
ENDCLASS

DECLARE d : INTEGER
d <- NEW Dog("Rex")
d.Speak()
d.Fetch()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["...", "Fetching!"]);
        });

        test("should support function method returning value", async () => {
            const code = `
CLASS Counter
    PRIVATE Count : INTEGER
    PUBLIC PROCEDURE NEW()
        Count <- 0
    ENDPROCEDURE
    PUBLIC PROCEDURE Increment()
        Count <- Count + 1
    ENDPROCEDURE
    PUBLIC FUNCTION GetCount() RETURNS INTEGER
        RETURN Count
    ENDFUNCTION
ENDCLASS

DECLARE c : INTEGER
c <- NEW Counter()
c.Increment()
c.Increment()
c.Increment()
OUTPUT c.GetCount()
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, "3");
        });

        test("should assign to object property via dot notation", async () => {
            const code = `
CLASS Point
    PUBLIC X : INTEGER
    PUBLIC Y : INTEGER
    PUBLIC PROCEDURE NEW(StartX : INTEGER, StartY : INTEGER)
        X <- StartX
        Y <- StartY
    ENDPROCEDURE
ENDCLASS

DECLARE p : INTEGER
p <- NEW Point(1, 2)
OUTPUT p.X
p.X <- 10
OUTPUT p.X
            `;

            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "10"]);
        });
    });
});
