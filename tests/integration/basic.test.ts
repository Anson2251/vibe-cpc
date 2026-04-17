import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: Basic", () => {
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
});
