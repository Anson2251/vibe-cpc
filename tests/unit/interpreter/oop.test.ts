import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";

async function execute(source: string, inputs: string[] = []) {
    const io = new MockIO();
    io.setInput(inputs);
    const interpreter = new Interpreter(io);
    const result = await interpreter.execute(source);
    return { result, output: io.getOutput().trim() };
}

describe("Object-oriented Programming (CPC 10.1-10.2)", () => {
    describe("10.1 Methods and Properties", () => {
        test("class with public property and method", async () => {
            const { result, output } = await execute(`
CLASS Counter
    PUBLIC Value : INTEGER
    PUBLIC PROCEDURE Increment()
        Value <- Value + 1
    ENDPROCEDURE
ENDCLASS

DECLARE c : Counter
c <- NEW Counter()
c.Value <- 0
c.Increment()
c.Increment()
OUTPUT c.Value
`);
            expect(result.success).toBe(true);
            expect(output).toBe("2");
        });

        test("class with private property", async () => {
            const { result, output } = await execute(`
CLASS Counter
    PRIVATE Value : INTEGER
    PUBLIC PROCEDURE SetValue(n : INTEGER)
        Value <- n
    ENDPROCEDURE
    PUBLIC PROCEDURE Increment()
        Value <- Value + 1
    ENDPROCEDURE
    PUBLIC FUNCTION GetValue() RETURNS INTEGER
        RETURN Value
    ENDFUNCTION
ENDCLASS

DECLARE c : Counter
c <- NEW Counter()
c.SetValue(10)
c.Increment()
OUTPUT c.GetValue()
`);
            expect(result.success).toBe(true);
            expect(output).toBe("11");
        });

        test("accessing private property from outside reports error", async () => {
            const { result } = await execute(`
CLASS Counter
    PRIVATE Value : INTEGER
ENDCLASS

DECLARE c : Counter
c <- NEW Counter()
c.Value <- 5
`);
            expect(result.success).toBe(false);
        });

        test("class with multiple methods", async () => {
            const { result, output } = await execute(`
CLASS Rectangle
    PUBLIC Width : INTEGER
    PUBLIC Height : INTEGER
    PUBLIC FUNCTION Area() RETURNS INTEGER
        RETURN Width * Height
    ENDFUNCTION
    PUBLIC FUNCTION Perimeter() RETURNS INTEGER
        RETURN 2 * (Width + Height)
    ENDFUNCTION
ENDCLASS

DECLARE r : Rectangle
r <- NEW Rectangle()
r.Width <- 5
r.Height <- 3
OUTPUT r.Area()
OUTPUT r.Perimeter()
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["15", "16"].join("\n"));
        });

        test("method with parameters", async () => {
            const { result, output } = await execute(`
CLASS Greeter
    PUBLIC PROCEDURE Greet(name : STRING)
        OUTPUT "Hello " & name
    ENDPROCEDURE
ENDCLASS

DECLARE g : Greeter
g <- NEW Greeter()
g.Greet("World")
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Hello World");
        });

        test("PUBLIC PROCEDURE SetAttempts example from spec", async () => {
            const { result, output } = await execute(`
CLASS Player
    PRIVATE Attempts : INTEGER
    PUBLIC PROCEDURE SetAttempts(Number : INTEGER)
        Attempts <- Number
    ENDPROCEDURE
    PRIVATE FUNCTION GetAttempts() RETURNS INTEGER
        RETURN Attempts
    ENDFUNCTION
    PUBLIC PROCEDURE ShowAttempts()
        OUTPUT GetAttempts()
    ENDPROCEDURE
ENDCLASS

DECLARE p : Player
p <- NEW Player()
p.SetAttempts(5)
p.ShowAttempts()
`);
            expect(result.success).toBe(true);
            expect(output).toBe("5");
        });
    });

    describe("10.2 Constructors and Inheritance", () => {
        test("constructor with NEW procedure", async () => {
            const { result, output } = await execute(`
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
`);
            expect(result.success).toBe(true);
            expect(output).toBe("Kitty");
        });

        test("inheritance with INHERITS", async () => {
            const { result, output } = await execute(`
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
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Kitty", "Shorthaired"].join("\n"));
        });

        test("SUPER calls parent constructor", async () => {
            const { result, output } = await execute(`
CLASS Animal
    PUBLIC Species : STRING
    PUBLIC PROCEDURE NEW(s : STRING)
        Species <- s
    ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
    PUBLIC Breed : STRING
    PUBLIC PROCEDURE NEW(b : STRING)
        SUPER.NEW("Dog")
        Breed <- b
    ENDPROCEDURE
ENDCLASS

DECLARE d : Dog
d <- NEW Dog("Labrador")
OUTPUT d.Species
OUTPUT d.Breed
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["Dog", "Labrador"].join("\n"));
        });

        test("child class inherits parent methods", async () => {
            const { result, output } = await execute(`
CLASS Shape
    PUBLIC Colour : STRING
    PUBLIC PROCEDURE NEW(c : STRING)
        Colour <- c
    ENDPROCEDURE
    PUBLIC FUNCTION Describe() RETURNS STRING
        RETURN "A " & Colour & " shape"
    ENDFUNCTION
ENDCLASS

CLASS Circle INHERITS Shape
    PUBLIC Radius : INTEGER
    PUBLIC PROCEDURE NEW(c : STRING, r : INTEGER)
        SUPER.NEW(c)
        Radius <- r
    ENDPROCEDURE
ENDCLASS

DECLARE ci : Circle
ci <- NEW Circle("red", 5)
OUTPUT ci.Describe()
OUTPUT ci.Radius
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["A red shape", "5"].join("\n"));
        });

        test("object creation with NEW keyword", async () => {
            const { result, output } = await execute(`
CLASS Point
    PUBLIC X : INTEGER
    PUBLIC Y : INTEGER
    PUBLIC PROCEDURE NEW(x : INTEGER, y : INTEGER)
        X <- x
        Y <- y
    ENDPROCEDURE
ENDCLASS

DECLARE p : Point
p <- NEW Point(3, 4)
OUTPUT p.X
OUTPUT p.Y
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["3", "4"].join("\n"));
        });

        test("multiple objects of same class are independent", async () => {
            const { result, output } = await execute(`
CLASS Counter
    PUBLIC Value : INTEGER
    PUBLIC PROCEDURE NEW()
        Value <- 0
    ENDPROCEDURE
    PUBLIC PROCEDURE Increment()
        Value <- Value + 1
    ENDPROCEDURE
ENDCLASS

DECLARE a : Counter
DECLARE b : Counter
a <- NEW Counter()
b <- NEW Counter()
a.Increment()
a.Increment()
b.Increment()
OUTPUT a.Value
OUTPUT b.Value
`);
            expect(result.success).toBe(true);
            expect(output).toBe(["2", "1"].join("\n"));
        });
    });
});
