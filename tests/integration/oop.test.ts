import { TestRunner, expectOutput, expectError } from "../test-helpers";

describe("Integration: OOP", () => {
    let testRunner: TestRunner;

    beforeEach(() => {
        testRunner = new TestRunner();
    });

    describe("Object-Oriented Programming", () => {
        test("should create object with constructor and access property", async () => {
            const code = `
CLASS Pet
    PRIVATE Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
    PUBLIC FUNCTION GetName() RETURNS STRING
        RETURN Name
    ENDFUNCTION
ENDCLASS

DECLARE MyPet : Pet
MyPet <- NEW Pet("Kitty")
OUTPUT MyPet.GetName()
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

DECLARE p : Player
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
    PUBLIC FUNCTION GetName() RETURNS STRING
        RETURN Name
    ENDFUNCTION
ENDCLASS

CLASS Cat INHERITS Pet
    PRIVATE Breed : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
        SUPER.NEW(GivenName)
        Breed <- GivenBreed
    ENDPROCEDURE
    PUBLIC FUNCTION GetBreed() RETURNS STRING
        RETURN Breed
    ENDFUNCTION
ENDCLASS

DECLARE MyCat : Cat
MyCat <- NEW Cat("Kitty", "Shorthaired")
OUTPUT MyCat.GetName()
OUTPUT MyCat.GetBreed()
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

DECLARE d : Dog
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

DECLARE d : Dog
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

DECLARE c : Counter
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

DECLARE p : Point
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
