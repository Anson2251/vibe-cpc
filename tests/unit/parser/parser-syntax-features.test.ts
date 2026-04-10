import { Lexer } from "../../../src/lexer/lexer";
import { Parser } from "../../../src/parser/parser";
import {
    AssignmentNode,
    CallExpressionNode,
    CaseNode,
    ClassDeclarationNode,
    InputNode,
    SetDeclarationNode,
    TypeDeclarationNode,
} from "../../../src/parser/ast-nodes";

function parseOrThrow(source: string) {
    const tokens = new Lexer(source).tokenize();
    const result = new Parser(tokens).parse();
    if (result.isErr()) {
        throw result.error;
    }
    return result.value;
}

describe("Parser syntax features", () => {
    test("parses CASE ranges and OTHERWISE branch", () => {
        const ast = parseOrThrow(`
CASE OF score
  0 TO 39 : OUTPUT "F"
  40 : OUTPUT "P"
  OTHERWISE : OUTPUT "?"
ENDCASE
`);

        const node = ast.body[0] as CaseNode;
        expect(node.type).toBe("Case");
        expect(node.cases).toHaveLength(2);
        expect(node.cases[0].values).toHaveLength(2);
        expect(node.cases[1].values).toHaveLength(1);
        expect(node.otherwise).toHaveLength(1);
    });

    test("parses enum type declaration", () => {
        const ast = parseOrThrow("TYPE Season = (Spring, Summer, Autumn, Winter)");

        const typeDecl = ast.body[0] as TypeDeclarationNode;
        expect(typeDecl.type).toBe("TypeDeclaration");
        expect(typeDecl.name).toBe("Season");
        expect(typeDecl.enumValues).toEqual(["Spring", "Summer", "Autumn", "Winter"]);
    });

    test("parses set type and DEFINE declaration", () => {
        const ast = parseOrThrow(`
TYPE LetterSet = SET OF CHAR
DEFINE Vowels('A','E','I','O','U') : LetterSet
`);

        const typeDecl = ast.body[0] as TypeDeclarationNode;
        const setDecl = ast.body[1] as SetDeclarationNode;

        expect(typeDecl.setElementType).toBe("CHAR");
        expect(setDecl.type).toBe("SetDeclaration");
        expect(setDecl.name).toBe("Vowels");
        expect(setDecl.setTypeName).toBe("LetterSet");
        expect(setDecl.values).toHaveLength(5);
    });

    test("parses class with inheritance, field and method", () => {
        const ast = parseOrThrow(`
CLASS Child INHERITS Parent
  PRIVATE DECLARE Age : INTEGER
  PUBLIC Speak()
    OUTPUT "hi"
  ENDCLASS
`);

        const classDecl = ast.body[0] as ClassDeclarationNode;
        expect(classDecl.type).toBe("ClassDeclaration");
        expect(classDecl.name).toBe("Child");
        expect(classDecl.inherits).toBe("Parent");
        expect(classDecl.fields).toHaveLength(1);
        expect(classDecl.methods).toHaveLength(1);
        expect(classDecl.methods[0].visibility).toBe("PUBLIC");
    });

    test("parses NEW expression assignment", () => {
        const ast = parseOrThrow("obj <- NEW Person(1, 'A')");

        const assignment = ast.body[0] as AssignmentNode;
        const expr = assignment.value as { type: string; className?: string; arguments?: unknown[] };
        expect(expr.type).toBe("NewExpression");
        expect(expr.className).toBe("Person");
        expect(expr.arguments).toHaveLength(2);
    });

    test("parses INPUT with prompt expression", () => {
        const ast = parseOrThrow('INPUT "Enter age: " age');

        const input = ast.body[0] as InputNode;
        expect(input.type).toBe("Input");
        expect(input.prompt?.type).toBe("Literal");
        expect(input.target.type).toBe("Identifier");
    });

    test("parses EOF(...) as call expression on right-hand side", () => {
        const ast = parseOrThrow('x <- EOF("data.txt")');

        const assignment = ast.body[0] as AssignmentNode;
        const call = assignment.value as CallExpressionNode;
        expect(call.type).toBe("CallExpression");
        expect(call.name).toBe("EOF");
        expect(call.arguments).toHaveLength(1);
    });
});
