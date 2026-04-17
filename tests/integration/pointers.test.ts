import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: Pointers", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
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
          DECLARE label : STRING
        ENDTYPE

        TYPE NodePtr = ^Node
        DECLARE n1 : Node
        DECLARE n2 : Node
        n1.Value <- 1
        n1.label <- "first"
        n2.Value <- 2
        n2.label <- "second"
        DECLARE nodes : ARRAY[1:2] OF NodePtr
        nodes[1] <- ^n1
        nodes[2] <- ^n2
        OUTPUT nodes[1]^.Value
        OUTPUT nodes[1]^.label
        OUTPUT nodes[2]^.Value
        OUTPUT nodes[2]^.label
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
});
