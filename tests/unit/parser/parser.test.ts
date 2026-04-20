import { Lexer } from "../../../src/lexer/lexer";
import { Parser } from "../../../src/parser/parser";
import { ProgramNode } from "../../../src/parser/ast-nodes";

function parse(source: string): ProgramNode {
    const tokens = new Lexer(source).tokenize();
    const result = new Parser(tokens).parse();
    if (result.isErr()) {
        throw new Error(`Parse error: ${result.error.message}`);
    }
    return result.value;
}

function parseError(source: string): string {
    const tokens = new Lexer(source).tokenize();
    const result = new Parser(tokens).parse();
    if (result.isErr()) {
        return result.error.message;
    }
    throw new Error("Expected parse error but got success");
}

describe("Parser", () => {
    describe("Expression precedence", () => {
        test("AND has lower precedence than comparison", () => {
            const ast = parse("IF x > 1 AND y < 2 THEN\nENDIF\n");
            const ifNode = ast.body[0] as any;
            expect(ifNode.type).toBe("If");
            expect(ifNode.condition.type).toBe("BinaryExpression");
            expect(ifNode.condition.operator).toBe("AND");
            expect(ifNode.condition.left.operator).toBe(">");
            expect(ifNode.condition.right.operator).toBe("<");
        });

        test("OR has lower precedence than AND", () => {
            const ast = parse("IF a AND b OR c THEN\nENDIF\n");
            const ifNode = ast.body[0] as any;
            expect(ifNode.condition.type).toBe("BinaryExpression");
            expect(ifNode.condition.operator).toBe("OR");
            expect(ifNode.condition.left.operator).toBe("AND");
        });

        test("NOT has higher precedence than AND", () => {
            const ast = parse("IF NOT a AND b THEN\nENDIF\n");
            const ifNode = ast.body[0] as any;
            expect(ifNode.condition.operator).toBe("AND");
            expect(ifNode.condition.left.type).toBe("UnaryExpression");
            expect(ifNode.condition.left.operator).toBe("NOT");
        });

        test("multiplication has higher precedence than addition", () => {
            const ast = parse("DECLARE x : INTEGER\nx <- 1 + 2 * 3\n");
            const assign = ast.body[1] as any;
            expect(assign.value.type).toBe("BinaryExpression");
            expect(assign.value.operator).toBe("+");
            expect(assign.value.right.operator).toBe("*");
        });

        test("parentheses override precedence", () => {
            const ast = parse("DECLARE x : INTEGER\nx <- (1 + 2) * 3\n");
            const assign = ast.body[1] as any;
            expect(assign.value.operator).toBe("*");
            expect(assign.value.left.operator).toBe("+");
        });
    });

    describe("Declarations", () => {
        test("parses simple variable declaration", () => {
            const ast = parse("DECLARE x : INTEGER\n");
            const decl = ast.body[0] as any;
            expect(decl.type).toBe("DeclareStatement");
            expect(decl.name).toBe("x");
            expect(decl.dataType).toBe("INTEGER");
        });

        test("parses array declaration", () => {
            const ast = parse("DECLARE arr : ARRAY[1:10] OF INTEGER\n");
            const decl = ast.body[0] as any;
            expect(decl.type).toBe("DeclareStatement");
            expect(decl.dataType.elementType).toBe("INTEGER");
            expect(decl.dataType.bounds).toHaveLength(1);
            expect(decl.dataType.bounds[0].lower).toBe(1);
            expect(decl.dataType.bounds[0].upper).toBe(10);
        });

        test("parses 2D array declaration", () => {
            const ast = parse("DECLARE grid : ARRAY[1:3, 1:4] OF REAL\n");
            const decl = ast.body[0] as any;
            expect(decl.dataType.bounds).toHaveLength(2);
        });

        test("parses CONSTANT declaration", () => {
            const ast = parse("CONSTANT Pi = 3.14\n");
            const decl = ast.body[0] as any;
            expect(decl.type).toBe("DeclareStatement");
            expect(decl.isConstant).toBe(true);
            expect(decl.initialValue.value).toBe(3.14);
        });

        test("parses pointer type declaration", () => {
            const ast = parse("TYPE IntPtr = ^INTEGER\n");
            const decl = ast.body[0] as any;
            expect(decl.type).toBe("TypeDeclaration");
            expect(decl.pointerType.kind).toBe("POINTER");
            expect(decl.pointerType.pointedType).toBe("INTEGER");
        });
    });

    describe("Control flow", () => {
        test("parses IF-THEN-ELSE-ENDIF", () => {
            const ast = parse('IF x > 0 THEN\nOUTPUT "pos"\nELSE\nOUTPUT "neg"\nENDIF\n');
            const ifNode = ast.body[0] as any;
            expect(ifNode.type).toBe("If");
            expect(ifNode.thenBranch).toHaveLength(1);
            expect(ifNode.elseBranch).toHaveLength(1);
        });

        test("parses IF-THEN-ENDIF without ELSE", () => {
            const ast = parse('IF x > 0 THEN\nOUTPUT "pos"\nENDIF\n');
            const ifNode = ast.body[0] as any;
            expect(ifNode.thenBranch).toHaveLength(1);
            expect(ifNode.elseBranch).toBeUndefined();
        });

        test("parses CASE with OTHERWISE", () => {
            const ast = parse(`DECLARE g : CHAR
g <- 'A'
CASE OF g
'A' : OUTPUT "ex"
OTHERWISE : OUTPUT "other"
ENDCASE\n`);
            const caseNode = ast.body.find((n: any) => n.type === "Case") as any;
            expect(caseNode.type).toBe("Case");
            expect(caseNode.cases).toHaveLength(1);
            expect(caseNode.otherwise).toHaveLength(1);
        });

        test("parses FOR-TO-NEXT", () => {
            const ast = parse("FOR i <- 1 TO 10\nOUTPUT i\nNEXT i\n");
            const forNode = ast.body[0] as any;
            expect(forNode.type).toBe("For");
            expect(forNode.start.value).toBe(1);
            expect(forNode.end.value).toBe(10);
            expect(forNode.step).toBeUndefined();
        });

        test("parses FOR-TO-STEP-NEXT", () => {
            const ast = parse("FOR i <- 10 TO 1 STEP -1\nOUTPUT i\nNEXT i\n");
            const forNode = ast.body[0] as any;
            expect(forNode.step.type).toBe("UnaryExpression");
            expect(forNode.step.operator).toBe("-");
            expect(forNode.step.operand.value).toBe(1);
        });

        test("parses WHILE-ENDWHILE", () => {
            const ast = parse("WHILE x > 0\nx <- x - 1\nENDWHILE\n");
            const whileNode = ast.body[0] as any;
            expect(whileNode.type).toBe("While");
            expect(whileNode.body).toHaveLength(1);
        });

        test("parses REPEAT-UNTIL", () => {
            const ast = parse("REPEAT\nx <- x - 1\nUNTIL x = 0\n");
            const repeatNode = ast.body[0] as any;
            expect(repeatNode.type).toBe("Repeat");
            expect(repeatNode.body).toHaveLength(1);
        });
    });

    describe("Procedures and functions", () => {
        test("parses procedure without parameters", () => {
            const ast = parse('PROCEDURE Greet()\nOUTPUT "hi"\nENDPROCEDURE\n');
            const proc = ast.body[0] as any;
            expect(proc.type).toBe("ProcedureDeclaration");
            expect(proc.name).toBe("Greet");
            expect(proc.parameters).toHaveLength(0);
        });

        test("parses procedure with BYREF parameter", () => {
            const ast = parse("PROCEDURE Inc(BYREF x : INTEGER)\nx <- x + 1\nENDPROCEDURE\n");
            const proc = ast.body[0] as any;
            expect(proc.parameters[0].mode).toBe("BYREF");
        });

        test("parses function with return type", () => {
            const ast = parse(
                "FUNCTION Double(x : INTEGER) RETURNS INTEGER\nRETURN x * 2\nENDFUNCTION\n",
            );
            const func = ast.body[0] as any;
            expect(func.type).toBe("FunctionDeclaration");
            expect(func.returnType).toBe("INTEGER");
        });

        test("parses CALL statement", () => {
            const ast = parse("CALL Greet()\n");
            const call = ast.body[0] as any;
            expect(call.type).toBe("CallStatement");
        });
    });

    describe("Type declarations", () => {
        test("parses TYPE-ENDTYPE record", () => {
            const ast = parse(`TYPE Student
DECLARE Name : STRING
DECLARE Age : INTEGER
ENDTYPE\n`);
            const typeDecl = ast.body[0] as any;
            expect(typeDecl.type).toBe("TypeDeclaration");
            expect(typeDecl.fields).toHaveLength(2);
        });

        test("parses enum type", () => {
            const ast = parse("TYPE Season = (Spring, Summer, Autumn, Winter)\n");
            const typeDecl = ast.body[0] as any;
            expect(typeDecl.type).toBe("TypeDeclaration");
            expect(typeDecl.enumValues).toHaveLength(4);
            expect(typeDecl.enumValues).toEqual(["Spring", "Summer", "Autumn", "Winter"]);
        });

        test("parses SET OF type", () => {
            const ast = parse("TYPE LetterSet = SET OF CHAR\n");
            const typeDecl = ast.body[0] as any;
            expect(typeDecl.type).toBe("TypeDeclaration");
            expect(typeDecl.setElementType).toBe("CHAR");
        });
    });

    describe("Class declarations", () => {
        test("parses CLASS with constructor and method", () => {
            const ast = parse(`CLASS Pet
PRIVATE Name : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING)
Name <- GivenName
ENDPROCEDURE
PUBLIC FUNCTION GetName() RETURNS STRING
RETURN Name
ENDFUNCTION
ENDCLASS\n`);
            const cls = ast.body[0] as any;
            expect(cls.type).toBe("ClassDeclaration");
            expect(cls.name).toBe("Pet");
            expect(cls.fields).toHaveLength(1);
            expect(cls.methods).toHaveLength(2);
        });

        test("parses INHERITS", () => {
            const ast = parse(`CLASS Dog INHERITS Animal
PUBLIC PROCEDURE Speak()
OUTPUT "Woof"
ENDPROCEDURE
ENDCLASS\n`);
            const cls = ast.body[0] as any;
            expect(cls.inherits).toBe("Animal");
        });
    });

    describe("File operations", () => {
        test("parses OPENFILE FOR RANDOM", () => {
            const ast = parse('OPENFILE "data.dat" FOR RANDOM\n');
            const openFile = ast.body[0] as any;
            expect(openFile.type).toBe("OpenFile");
            expect(openFile.mode).toBe("RANDOM");
        });

        test("parses SEEK", () => {
            const ast = parse('SEEK "data.dat", 5\n');
            const seek = ast.body[0] as any;
            expect(seek.type).toBe("Seek");
        });

        test("parses GETRECORD", () => {
            const ast = parse('GETRECORD "data.dat", rec\n');
            const getRec = ast.body[0] as any;
            expect(getRec.type).toBe("GetRecord");
        });

        test("parses PUTRECORD", () => {
            const ast = parse('PUTRECORD "data.dat", rec\n');
            const putRec = ast.body[0] as any;
            expect(putRec.type).toBe("PutRecord");
        });
    });

    describe("Pointers", () => {
        test("parses pointer dereference p^", () => {
            const ast = parse("DECLARE x : INTEGER\nOUTPUT p^\n");
            const output = ast.body[1] as any;
            expect(output.expressions[0].type).toBe("PointerDereference");
        });

        test("parses address-of ^x", () => {
            const ast = parse("TYPE IntPtr = ^INTEGER\nDECLARE p : IntPtr\np <- ^x\n");
            const assign = ast.body[2] as any;
            expect(assign.value.type).toBe("AddressOf");
        });

        test("parses DISPOSE", () => {
            const ast = parse("TYPE IntPtr = ^INTEGER\nDECLARE p : IntPtr\nDISPOSE p\n");
            const dispose = ast.body[2] as any;
            expect(dispose.type).toBe("DisposeStatement");
        });
    });

    describe("Error messages", () => {
        test("reports missing ENDIF", () => {
            expect(parseError("IF x > 0 THEN\nOUTPUT x\n")).toContain("ENDIF");
        });

        test("reports missing ENDPROCEDURE", () => {
            expect(parseError("PROCEDURE Foo()\nOUTPUT x\n")).toContain("ENDPROCEDURE");
        });

        test("reports missing ENDFUNCTION", () => {
            expect(parseError("FUNCTION Foo() RETURNS INTEGER\nRETURN 1\n")).toContain(
                "ENDFUNCTION",
            );
        });

        test("reports missing ENDWHILE", () => {
            expect(parseError("WHILE x > 0\nx <- x - 1\n")).toContain("ENDWHILE");
        });

        test("reports missing ENDCASE", () => {
            expect(parseError("CASE OF x\n1 : OUTPUT a\n")).toContain("ENDCASE");
        });

        test("reports missing ENDTYPE", () => {
            expect(parseError("TYPE Record\nDECLARE x : INTEGER\n")).toContain("ENDTYPE");
        });

        test("reports missing ENDCLASS", () => {
            expect(parseError("CLASS Foo\nPUBLIC X : INTEGER\n")).toContain("ENDCLASS");
        });
    });
});
