import { TestRunner, expectOutput, expectError } from '../test-helpers';

describe('Interpreter Integration Tests', () => {
  let testRunner: TestRunner;

  beforeEach(() => {
    testRunner = new TestRunner();
  });

  describe('Basic programs', () => {
    test('should execute hello world program', async () => {
      const code = `
        DECLARE message : STRING
        message <- "Hello, World!"
        OUTPUT message
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, 'Hello, World!');
    });

    test('should execute arithmetic operations', async () => {
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
      expectOutput(result, ['15', '5', '50', '2', '0']);
    });

    test('should handle real number arithmetic', async () => {
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
      expectOutput(result, ['5.1', '1.1', '6.2', '1.55']);
    });

    test('should handle string operations', async () => {
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
      expectOutput(result, ['Hello World', '11']);
    });
  });

  describe('Control structures', () => {
    test('should execute IF statement', async () => {
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
      expectOutput(result, 'Greater than 5');
    });

    test('should execute nested IF statements', async () => {
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
      expectOutput(result, 'Both conditions true');
    });

    test('should execute CASE statement', async () => {
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
      expectOutput(result, 'Good');
    });
  });

  describe('Loops', () => {
    test('should execute FOR loop', async () => {
      const code = `
        DECLARE i : INTEGER
        FOR i <- 1 TO 5
          OUTPUT i
        NEXT i
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, ['1', '2', '3', '4', '5']);
    });

    test('should execute FOR loop with STEP', async () => {
      const code = `
        DECLARE i : INTEGER
        FOR i <- 1 TO 10 STEP 2
          OUTPUT i
        NEXT i
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, ['1', '3', '5', '7', '9']);
    });

    test('should execute WHILE loop', async () => {
      const code = `
        DECLARE i : INTEGER
        i <- 1
        WHILE i <= 5
          OUTPUT i
          i <- i + 1
        ENDWHILE
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, ['1', '2', '3', '4', '5']);
    });

    test('should execute REPEAT loop', async () => {
      const code = `
        DECLARE i : INTEGER
        i <- 1
        REPEAT
          OUTPUT i
          i <- i + 1
        UNTIL i > 5
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, ['1', '2', '3', '4', '5']);
    });
  });

  describe('Procedures and functions', () => {
    test('should execute procedure call', async () => {
      const code = `
        PROCEDURE PrintMessage()
          OUTPUT "Hello from procedure"
        ENDPROCEDURE

        CALL PrintMessage()
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, 'Hello from procedure');
    });

    test('should execute procedure with parameters', async () => {
      const code = `
        PROCEDURE AddNumbers(x : INTEGER, y : INTEGER)
          OUTPUT x + y
        ENDPROCEDURE

        CALL AddNumbers(10, 20)
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, '30');
    });

    test('should execute function call', async () => {
      const code = `
        FUNCTION Add(x : INTEGER, y : INTEGER) RETURNS INTEGER
          RETURN x + y
        ENDFUNCTION

        DECLARE result : INTEGER
        result <- Add(15, 25)
        OUTPUT result
      `;

      const result = await testRunner.runCode(code);
      expectOutput(result, '40');
    });

    test('should handle recursive function', async () => {
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
      expectOutput(result, '120');
    });
  });

  describe('Arrays', () => {
    test('should handle array declarations and access', async () => {
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
      expectOutput(result, ['10', '20', '30', '40', '50']);
    });

    test('should handle two-dimensional arrays', async () => {
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
      expectOutput(result, ['1', '2', '3', '4']);
    });
  });

  describe('File operations', () => {
    test('should handle file writing and reading', async () => {
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
      expectOutput(result, 'Hello, file!');
    });
  });

  describe('Error handling', () => {
    test('should handle division by zero', async () => {
      const code = `
        DECLARE x : INTEGER
        DECLARE y : INTEGER
        DECLARE result : INTEGER
        x <- 10
        y <- 0
        result <- x / y
        OUTPUT result
      `;

      const result = await testRunner.runCode(code);
      expectError(result, 'division by zero');
    });

    test('should handle undefined variables', async () => {
      const code = `
        OUTPUT undefinedVariable
      `;

      const result = await testRunner.runCode(code);
      expectError(result, 'undefined');
    });

    test('should handle type mismatches', async () => {
      const code = `
        DECLARE x : INTEGER
        DECLARE y : STRING
        x <- 10
        y <- "hello"
        OUTPUT x + y
      `;

      const result = await testRunner.runCode(code);
      expectError(result, 'type');
    });
  });
});
