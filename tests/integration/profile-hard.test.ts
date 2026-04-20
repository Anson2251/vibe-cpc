import { TestRunner, expectOutput } from "../test-helpers";

describe("Profile-Hard: Performance Benchmarks", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("1. Lexer throughput – large source with many tokens", () => {
        test("should lex 4000 variable declarations efficiently", async () => {
            const lines: string[] = [];
            for (let i = 0; i < 4000; i++) {
                lines.push(`DECLARE var${i} : INTEGER`);
            }
            lines.push("DECLARE result : INTEGER");
            lines.push("result <- 0");
            lines.push("OUTPUT result");
            const code = lines.join("\n");

            const result = await testRunner.runCode(code);
            expectOutput(result, "0");
        });

        test("should lex 1500 constant declarations efficiently", async () => {
            const lines: string[] = [];
            for (let i = 0; i < 1500; i++) {
                lines.push(`CONSTANT C${i} = ${i}`);
            }
            lines.push("OUTPUT C1499");
            const code = lines.join("\n");

            const result = await testRunner.runCode(code);
            expectOutput(result, "1499");
        });
    });

    describe("2. Parser depth – deeply nested structures", () => {
        test("should parse 120-level nested IF statements", async () => {
            const lines: string[] = [];
            lines.push("DECLARE x : INTEGER");
            lines.push("x <- 1");
            for (let i = 0; i < 120; i++) {
                lines.push(`${"  ".repeat(i)}IF x = 1 THEN`);
            }
            lines.push(`${"  ".repeat(120)}OUTPUT "deep"`);
            for (let i = 119; i >= 0; i--) {
                lines.push(`${"  ".repeat(i)}ENDIF`);
            }
            const code = lines.join("\n");

            const result = await testRunner.runCode(code);
            expectOutput(result, "deep");
        });

        test("should parse 20-level nested FOR loops", async () => {
            const lines: string[] = [];
            for (let i = 0; i < 20; i++) {
                lines.push(`DECLARE i${i} : INTEGER`);
            }
            for (let i = 0; i < 20; i++) {
                const indent = "  ".repeat(i);
                lines.push(`${indent}FOR i${i} <- 1 TO 1`);
            }
            lines.push(`${"  ".repeat(20)}OUTPUT "inner"`);
            for (let i = 19; i >= 0; i--) {
                lines.push(`${"  ".repeat(i)}NEXT i${i}`);
            }
            const code = lines.join("\n");

            const result = await testRunner.runCode(code);
            expect(result.success).toBe(true);
        }, 60000);
    });

    describe("3. Loop-heavy evaluation – iteration hotspot", () => {
        test("should sum 1..200000 in a FOR loop", async () => {
            const code = `
DECLARE total : INTEGER
DECLARE i : INTEGER
total <- 0
FOR i <- 1 TO 200000
  total <- total + i
NEXT i
OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "20000100000");
        });

        test("should sum 1..200000 in a WHILE loop", async () => {
            const code = `
DECLARE total : INTEGER
DECLARE i : INTEGER
total <- 0
i <- 1
WHILE i <= 200000
  total <- total + i
  i <- i + 1
ENDWHILE
OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "20000100000");
        });

        test("should sum 1..200000 in a REPEAT loop", async () => {
            const code = `
DECLARE total : INTEGER
DECLARE i : INTEGER
total <- 0
i <- 1
REPEAT
  total <- total + i
  i <- i + 1
UNTIL i > 200000
OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "20000100000");
        });

        test("should run nested FOR loops (800x800 = 640000 iterations)", async () => {
            const code = `
DECLARE total : INTEGER
DECLARE i : INTEGER
DECLARE j : INTEGER
total <- 0
FOR i <- 1 TO 800
  FOR j <- 1 TO 800
    total <- total + 1
  NEXT j
NEXT i
OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "640000");
        });
    });

    describe("4. Recursive evaluation – call stack hotspot", () => {
        test("should compute Factorial(20) recursively", async () => {
            const code = `
FUNCTION Factorial(n : INTEGER) RETURNS INTEGER
  IF n <= 1 THEN
    RETURN 1
  ELSE
    RETURN n * Factorial(n - 1)
  ENDIF
ENDFUNCTION

OUTPUT Factorial(20)
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "2432902008176640000");
        });

        test("should compute Fibonacci(27) recursively", async () => {
            const code = `
FUNCTION Fib(n : INTEGER) RETURNS INTEGER
  IF n <= 1 THEN
    RETURN n
  ELSE
    RETURN Fib(n - 1) + Fib(n - 2)
  ENDIF
ENDFUNCTION

OUTPUT Fib(27)
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "196418");
        }, 15000);

        test("should compute Fibonacci(80) iteratively for comparison", async () => {
            const code = `
FUNCTION FibIter(n : INTEGER) RETURNS INTEGER
  DECLARE a : INTEGER
  DECLARE b : INTEGER
  DECLARE temp : INTEGER
  DECLARE i : INTEGER
  a <- 0
  b <- 1
  FOR i <- 1 TO n
    temp <- a + b
    a <- b
    b <- temp
  NEXT i
  RETURN a
ENDFUNCTION

OUTPUT FibIter(80)
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "23416728348467684");
        });
    });

    describe("5. Array operations – memory and index hotspot", () => {
        test("should initialize and sum a 50000-element array", async () => {
            const code = `
DECLARE arr : ARRAY[1:50000] OF INTEGER
DECLARE i : INTEGER
DECLARE total : INTEGER

FOR i <- 1 TO 50000
  arr[i] <- i
NEXT i

total <- 0
FOR i <- 1 TO 50000
  total <- total + arr[i]
NEXT i

OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "1250025000");
        });

        test("should traverse a 350x350 2D array", async () => {
            const code = `
DECLARE matrix : ARRAY[1:350, 1:350] OF INTEGER
DECLARE i : INTEGER
DECLARE j : INTEGER
DECLARE total : INTEGER

FOR i <- 1 TO 350
  FOR j <- 1 TO 350
    matrix[i, j] <- i * 350 + j
  NEXT j
NEXT i

total <- 0
FOR i <- 1 TO 350
  FOR j <- 1 TO 350
    total <- total + matrix[i, j]
  NEXT j
NEXT i

OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "7546061250");
        });

        test("should bubble sort a 1000-element array", async () => {
            const code = `
DECLARE arr : ARRAY[1:1000] OF INTEGER
DECLARE i : INTEGER
DECLARE j : INTEGER
DECLARE temp : INTEGER

FOR i <- 1 TO 1000
  arr[i] <- 1001 - i
NEXT i

FOR i <- 1 TO 999
  FOR j <- 1 TO 1000 - i
    IF arr[j] > arr[j + 1] THEN
      temp <- arr[j]
      arr[j] <- arr[j + 1]
      arr[j + 1] <- temp
    ENDIF
  NEXT j
NEXT i

OUTPUT arr[1]
OUTPUT arr[500]
OUTPUT arr[1000]
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["1", "500", "1000"]);
        }, 60000);
    });

    describe("6. String operations – concatenation and manipulation hotspot", () => {
        test("should concatenate 15000 strings in a loop", async () => {
            const code = `
DECLARE result : STRING
DECLARE i : INTEGER
result <- ""
FOR i <- 1 TO 15000
  result <- result & "x"
NEXT i
OUTPUT LENGTH(result)
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "15000");
        });

        test("should call MID/LEFT/RIGHT 15000 times", async () => {
            const code = `
DECLARE s : STRING
DECLARE i : INTEGER
DECLARE total : INTEGER

s <- "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
total <- 0

FOR i <- 1 TO 15000
  total <- total + LENGTH(LEFT(s, 10))
  total <- total + LENGTH(RIGHT(s, 10))
  total <- total + LENGTH(MID(s, 5, 10))
NEXT i

OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "450000");
        });
    });

    describe("7. OOP – object instantiation and method call hotspot", () => {
        test("should call Increment 150000 times on a single object", async () => {
            const code = `
CLASS Counter
  PRIVATE Value : INTEGER
  PUBLIC PROCEDURE NEW()
    Value <- 0
  ENDPROCEDURE
  PUBLIC PROCEDURE Increment()
    Value <- Value + 1
  ENDPROCEDURE
  PUBLIC FUNCTION GetValue() RETURNS INTEGER
    RETURN Value
  ENDFUNCTION
ENDCLASS

DECLARE c : Counter
DECLARE i : INTEGER
c <- NEW Counter()

FOR i <- 1 TO 150000
  c.Increment()
NEXT i

OUTPUT c.GetValue()
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "150000");
        });

        test("should exercise inheritance with method override 15000 times", async () => {
            const code = `
CLASS Animal
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name <- GivenName
  ENDPROCEDURE
  PUBLIC FUNCTION GetName() RETURNS STRING
    RETURN Name
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Animal
  PRIVATE BarkCount : INTEGER
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    SUPER.NEW(GivenName)
    BarkCount <- 0
  ENDPROCEDURE
  PUBLIC PROCEDURE Speak()
    BarkCount <- BarkCount + 1
  ENDPROCEDURE
  PUBLIC FUNCTION GetBarkCount() RETURNS INTEGER
    RETURN BarkCount
  ENDFUNCTION
ENDCLASS

DECLARE d : Dog
DECLARE i : INTEGER
d <- NEW Dog("Rex")

FOR i <- 1 TO 15000
  d.Speak()
NEXT i

OUTPUT d.GetBarkCount()
OUTPUT d.GetName()
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["15000", "Rex"]);
        });
    });

    describe("8. Procedure/Function call overhead – BYREF vs BYVAL", () => {
        test("should call procedure with BYREF 60000 times", async () => {
            const code = `
PROCEDURE AddOne(BYREF x : INTEGER)
  x <- x + 1
ENDPROCEDURE

DECLARE val : INTEGER
DECLARE i : INTEGER
val <- 0
FOR i <- 1 TO 60000
  CALL AddOne(val)
NEXT i
OUTPUT val
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "60000");
        });

        test("should call function with BYVAL 60000 times", async () => {
            const code = `
FUNCTION AddOne(x : INTEGER) RETURNS INTEGER
  RETURN x + 1
ENDFUNCTION

DECLARE val : INTEGER
DECLARE i : INTEGER
val <- 0
FOR i <- 1 TO 60000
  val <- AddOne(val)
NEXT i
OUTPUT val
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "60000");
        });

        test("should call procedure with 5 BYREF params 30000 times", async () => {
            const code = `
PROCEDURE UpdateAll(BYREF a : INTEGER, BYREF b : INTEGER, BYREF c : INTEGER, BYREF d : INTEGER, BYREF e : INTEGER)
  a <- a + 1
  b <- b + 2
  c <- c + 3
  d <- d + 4
  e <- e + 5
ENDPROCEDURE

DECLARE a : INTEGER
DECLARE b : INTEGER
DECLARE c : INTEGER
DECLARE d : INTEGER
DECLARE e : INTEGER
DECLARE i : INTEGER
a <- 0
b <- 0
c <- 0
d <- 0
e <- 0
FOR i <- 1 TO 30000
  CALL UpdateAll(a, b, c, d, e)
NEXT i
OUTPUT a
OUTPUT b
OUTPUT c
OUTPUT d
OUTPUT e
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["30000", "60000", "90000", "120000", "150000"]);
        });
    });

    describe("9. Mixed realistic – algorithm workloads", () => {
        test("should compute prime sieve up to 15000", async () => {
            const code = `
DECLARE isPrime : ARRAY[1:15000] OF BOOLEAN
DECLARE i : INTEGER
DECLARE j : INTEGER
DECLARE count : INTEGER

FOR i <- 1 TO 15000
  isPrime[i] <- TRUE
NEXT i

isPrime[1] <- FALSE
i <- 2
WHILE i * i <= 15000
  IF isPrime[i] THEN
    j <- i * i
    WHILE j <= 15000
      isPrime[j] <- FALSE
      j <- j + i
    ENDWHILE
  ENDIF
  i <- i + 1
ENDWHILE

count <- 0
FOR i <- 1 TO 15000
  IF isPrime[i] THEN
    count <- count + 1
  ENDIF
NEXT i

OUTPUT count
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "1754");
        });

        test("should perform linear search 5000 times on 500-element array", async () => {
            const code = `
FUNCTION LinearSearch(arr : ARRAY[1:500] OF INTEGER, target : INTEGER, n : INTEGER) RETURNS INTEGER
  DECLARE i : INTEGER
  FOR i <- 1 TO n
    IF arr[i] = target THEN
      RETURN i
    ENDIF
  NEXT i
  RETURN -1
ENDFUNCTION

DECLARE data : ARRAY[1:500] OF INTEGER
DECLARE i : INTEGER
DECLARE result : INTEGER
DECLARE found : INTEGER

FOR i <- 1 TO 500
  data[i] <- i * 3
NEXT i

found <- 0
FOR i <- 1 TO 5000
  result <- LinearSearch(data, ((i - 1) MOD 500) * 3 + 3, 500)
  IF result <> -1 THEN
    found <- found + 1
  ENDIF
NEXT i

OUTPUT found
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "5000");
        }, 60000);

        test("should compute GCD of 5000 pairs using Euclidean algorithm", async () => {
            const code = `
FUNCTION GCD(a : INTEGER, b : INTEGER) RETURNS INTEGER
  DECLARE temp : INTEGER
  WHILE b <> 0
    temp <- b
    b <- a MOD b
    a <- temp
  ENDWHILE
  RETURN a
ENDFUNCTION

DECLARE i : INTEGER
DECLARE total : INTEGER
total <- 0
FOR i <- 1 TO 5000
  total <- total + GCD(i * 12, i * 18)
NEXT i
OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "75015000");
        });

        test("should perform matrix multiplication 35x35", async () => {
            const code = `
DECLARE A : ARRAY[1:35, 1:35] OF INTEGER
DECLARE B : ARRAY[1:35, 1:35] OF INTEGER
DECLARE C : ARRAY[1:35, 1:35] OF INTEGER
DECLARE i : INTEGER
DECLARE j : INTEGER
DECLARE k : INTEGER
DECLARE sum : INTEGER

FOR i <- 1 TO 35
  FOR j <- 1 TO 35
    A[i, j] <- i + j
    B[i, j] <- i * j
  NEXT j
NEXT i

FOR i <- 1 TO 35
  FOR j <- 1 TO 35
    sum <- 0
    FOR k <- 1 TO 35
      sum <- sum + A[i, k] * B[k, j]
    NEXT k
    C[i, j] <- sum
  NEXT j
NEXT i

OUTPUT C[1, 1]
OUTPUT C[18, 18]
OUTPUT C[35, 35]
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["15540", "472500", "1293600"]);
        });
    });

    describe("10. User-defined types and records hotspot", () => {
        test("should create and traverse array of 5000 records", async () => {
            const code = `
TYPE StudentRecord
  DECLARE Name : STRING
  DECLARE Score : INTEGER
ENDTYPE

DECLARE students : ARRAY[1:5000] OF StudentRecord
DECLARE i : INTEGER
DECLARE total : INTEGER

FOR i <- 1 TO 5000
  students[i].Name <- "Student"
  students[i].Score <- i
NEXT i

total <- 0
FOR i <- 1 TO 5000
  total <- total + students[i].Score
NEXT i

OUTPUT total
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, "12502500");
        });

        test("should pass records BYREF through 5000 calls", async () => {
            const code = `
TYPE Point
  DECLARE X : INTEGER
  DECLARE Y : INTEGER
ENDTYPE

PROCEDURE Translate(BYREF p : Point, dx : INTEGER, dy : INTEGER)
  p.X <- p.X + dx
  p.Y <- p.Y + dy
ENDPROCEDURE

DECLARE pt : Point
DECLARE i : INTEGER
pt.X <- 0
pt.Y <- 0

FOR i <- 1 TO 5000
  CALL Translate(pt, 1, 2)
NEXT i

OUTPUT pt.X
OUTPUT pt.Y
            `;
            const result = await testRunner.runCode(code);
            expectOutput(result, ["5000", "10000"]);
        });
    });
});
