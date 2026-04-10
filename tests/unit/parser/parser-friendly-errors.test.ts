import { Lexer } from "../../../src/lexer/lexer";
import { Parser } from "../../../src/parser/parser";

function parseErrorMessage(source: string): string {
    const tokens = new Lexer(source).tokenize();
    const result = new Parser(tokens).parse();
    if (result.isOk()) {
        throw new Error("Expected parse to fail, but it succeeded");
    }
    return result.error.message;
}

describe("Parser friendly error messages", () => {
    test("reports missing ENDCLASS with clear end-of-input wording", () => {
        const message = parseErrorMessage(`
CLASS Student
  PRIVATE DECLARE Age : INTEGER
`);

        expect(message).toContain("Expected 'ENDCLASS' to close class declaration");
        expect(message).toContain("end of input");
    });

    test("reports missing THEN with found token context", () => {
        const message = parseErrorMessage(`
IF x > 0
  OUTPUT "ok"
ENDIF
`);

        expect(message).toContain("Expected 'THEN' after IF condition");
        expect(message).toContain("newline");
    });

    test("reports malformed CASE arm with specific expectation", () => {
        const message = parseErrorMessage(`
CASE OF score
  10 OUTPUT "A"
ENDCASE
`);

        expect(message).toContain("Expected ':' after CASE values");
        expect(message).toContain("'OUTPUT'");
    });

    test("reports function declaration missing RETURNS with found token", () => {
        const message = parseErrorMessage(`
FUNCTION Add(x : INTEGER, y : INTEGER)
  RETURN x + y
ENDFUNCTION
`);

        expect(message).toContain("Expected 'RETURNS' in function declaration");
        expect(message).toContain("'RETURN'");
    });

    test("reports missing ENDIF with end-of-input context", () => {
        const message = parseErrorMessage(`
IF x > 0 THEN
  OUTPUT "ok"
`);

        expect(message).toContain("Expected 'ENDIF' to close IF statement");
        expect(message).toContain("end of input");
    });

    test("reports missing NEXT with end-of-input context", () => {
        const message = parseErrorMessage(`
FOR i <- 1 TO 3
  OUTPUT i
`);

        expect(message).toContain("Expected 'NEXT' to close FOR loop");
        expect(message).toContain("end of input");
    });

    test("reports missing ENDWHILE with end-of-input context", () => {
        const message = parseErrorMessage(`
WHILE x < 3
  OUTPUT x
`);

        expect(message).toContain("Expected 'ENDWHILE' to close WHILE loop");
        expect(message).toContain("end of input");
    });

    test("reports missing UNTIL for REPEAT block", () => {
        const message = parseErrorMessage(`
REPEAT
  OUTPUT "loop"
`);

        expect(message).toContain("Expected 'UNTIL' to close REPEAT loop");
        expect(message).toContain("end of input");
    });

    test("reports missing ENDCASE with end-of-input context", () => {
        const message = parseErrorMessage(`
CASE OF score
  1 : OUTPUT "one"
`);

        expect(message).toContain("Expected 'ENDCASE' to close CASE statement");
        expect(message).toContain("end of input");
    });

    test("reports missing ENDTYPE with end-of-input context", () => {
        const message = parseErrorMessage(`
TYPE Person
  DECLARE age : INTEGER
`);

        expect(message).toContain("Expected 'ENDTYPE' to close type declaration");
        expect(message).toContain("end of input");
    });

    test("reports missing ENDPROCEDURE with end-of-input context", () => {
        const message = parseErrorMessage(`
PROCEDURE PrintX()
  OUTPUT "x"
`);

        expect(message).toContain("Expected 'ENDPROCEDURE' to close procedure declaration");
        expect(message).toContain("end of input");
    });

    test("reports missing ENDFUNCTION with end-of-input context", () => {
        const message = parseErrorMessage(`
FUNCTION Add(x : INTEGER, y : INTEGER)
RETURNS INTEGER
  RETURN x + y
`);

        expect(message).toContain("Expected 'ENDFUNCTION' to close function declaration");
        expect(message).toContain("end of input");
    });

    test("reports standalone ELSE without matching IF", () => {
        const message = parseErrorMessage("ELSE\n");
        expect(message).toContain("Unexpected 'ELSE' without a matching IF block");
    });

    test("reports standalone ENDIF without matching IF", () => {
        const message = parseErrorMessage("ENDIF\n");
        expect(message).toContain("Unexpected 'ENDIF' without a matching IF block");
    });

    test("reports standalone THEN with usage guidance", () => {
        const message = parseErrorMessage("THEN\n");
        expect(message).toContain("'THEN' can only be used after an IF condition");
    });

    test("reports mismatched END keyword in IF block", () => {
        const message = parseErrorMessage(`
IF x > 0 THEN
  OUTPUT "ok"
ENDWHILE
`);

        expect(message).toContain("Unexpected 'ENDWHILE' without a matching WHILE loop");
    });

    test("guides beginners to use <- instead of = for assignment", () => {
        const message = parseErrorMessage("x = 1");

        expect(message).toContain("Use '<-' for assignment instead of '='");
    });

    test("reports missing type colon in DECLARE with concrete token context", () => {
        const message = parseErrorMessage("DECLARE age INTEGER");

        expect(message).toContain("Expected ':' after variable name, before data type");
        expect(message).toContain("'INTEGER'");
    });

    test("reports OPENFILE missing FOR keyword clearly", () => {
        const message = parseErrorMessage('OPENFILE "data.txt" READ');

        expect(message).toContain("Expected 'FOR' after file identifier");
        expect(message).toContain("'READ'");
    });

    test("reports READFILE missing comma between file and target", () => {
        const message = parseErrorMessage('READFILE "data.txt" line');

        expect(message).toContain("Expected ',' after file identifier");
        expect(message).toContain("'line'");
    });

    test("reports unterminated call arguments with end-of-input wording", () => {
        const message = parseErrorMessage("CALL Print(1, 2");

        expect(message).toContain("Expected ')' after arguments");
        expect(message).toContain("end of input");
    });
});
