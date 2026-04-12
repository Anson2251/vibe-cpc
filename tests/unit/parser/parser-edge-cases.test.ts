import { Lexer } from "../../../src/lexer/lexer";
import { Parser } from "../../../src/parser/parser";
import { AssignmentNode, IfNode, SetLiteralNode } from "../../../src/parser/ast-nodes";

function parse(source: string) {
    const tokens = new Lexer(source).tokenize();
    return new Parser(tokens).parse();
}

describe("Parser edge cases", () => {
    test("returns parse error for DECLARE with assignment", () => {
        const result = parse("DECLARE x : INTEGER <- 1");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.message).toContain("Assignment not allowed in DECLARE");
        }
    });

    test("parses IF with ELSE branch and nested statements", () => {
        const result = parse(`
IF 1 = 1 THEN
  OUTPUT "ok"
ELSE
  OUTPUT "no"
ENDIF
`);
        expect(result.isOk()).toBe(true);

        if (result.isOk()) {
            const ifNode = result.value.body[0] as IfNode;
            expect(ifNode.thenBranch).toHaveLength(1);
            expect(ifNode.elseBranch).toHaveLength(1);
        }
    });

    test("parses set literal assignment expression", () => {
        const result = parse("x <- [1, 2, 3]");
        expect(result.isOk()).toBe(true);

        if (result.isOk()) {
            const assignment = result.value.body[0] as AssignmentNode;
            const setLiteral = assignment.value as SetLiteralNode;
            expect(setLiteral.type).toBe("SetLiteral");
            expect(setLiteral.elements).toHaveLength(3);
        }
    });

    test("accepts integer variables as array bounds", () => {
        const result = parse("DECLARE a : ARRAY[1:x] OF INTEGER");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.body).toHaveLength(1);
        }
    });
});
