import { Interpreter } from "./src/interpreter";
import { MockIO } from "./tests/mock-io";

async function main() {
    const io = new MockIO();
    const interpreter = new Interpreter(io);

    const code = `
CLASS Pet
    PUBLIC Name : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING)
        Name <- GivenName
    ENDPROCEDURE
ENDCLASS

CLASS Cat INHERITS Pet
    PUBLIC Breed : STRING
    PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
        SUPER.NEW(GivenName)
        Breed <- GivenBreed
    ENDPROCEDURE
ENDCLASS

DECLARE MyCat : Cat
MyCat <- NEW Cat("Kitty", "Shorthaired")
OUTPUT MyCat.Name
OUTPUT MyCat.Breed
`;

    const result = await interpreter.execute(code);
    console.log("Success:", result.success);
    console.log("Output:", io.getOutput());
    if (!result.success && 'error' in result) {
        console.log("Error:", result.error);
    }
}

main();
