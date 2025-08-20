import { Parser } from '../../src/parser/parser';
import { Lexer } from '../../src/lexer/lexer';
import { TokenType } from '../../src/lexer/tokens';
import {
  ProgramNode,
  VariableDeclarationNode,
  AssignmentNode,
  IfNode,
  ForNode,
  WhileNode,
  RepeatNode,
  OutputNode,
  InputNode,
  BinaryExpressionNode,
  IdentifierNode,
  LiteralNode,
  CallStatementNode,
  ProcedureDeclarationNode,
  FunctionDeclarationNode
} from '../../src/parser/ast-nodes';

describe('Parser', () => {
  function parseCode(code: string): ProgramNode {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  }

  describe('Basic parsing', () => {
    test('should parse empty program', () => {
      const code = '';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(0);
    });

    test('should parse simple variable declaration', () => {
      const code = 'DECLARE x : INTEGER';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);

      const statement = ast.body[0] as VariableDeclarationNode;
      expect(statement.type).toBe('DeclareStatement');
      expect(statement.name).toBe('x');
      expect(statement.dataType).toBe('INTEGER');
      expect(statement.isConstant).toBe(false);
    });

    test('should parse constant declaration', () => {
      const code = 'CONSTANT PI = 3.14';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);

      const statement = ast.body[0] as VariableDeclarationNode;
      expect(statement.type).toBe('DeclareStatement');
      expect(statement.name).toBe('PI');
      expect(statement.isConstant).toBe(true);

      const initialValue = statement.initialValue as LiteralNode;
      expect(initialValue.type).toBe('Literal');
      expect(initialValue.value).toBe(3.14);
    });

    test('should parse assignment statement', () => {
      const code = 'x <- 42';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);

      const statement = ast.body[0] as AssignmentNode;
      expect(statement.type).toBe('Assignment');

      const target = statement.target as IdentifierNode;
      expect(target.type).toBe('Identifier');
      expect(target.name).toBe('x');

      const value = statement.value as LiteralNode;
      expect(value.type).toBe('Literal');
      expect(value.value).toBe(42);
    });

    test('should parse output statement', () => {
      const code = 'OUTPUT "Hello, World!"';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);

      const statement = ast.body[0] as OutputNode;
      expect(statement.type).toBe('Output');
      expect(statement.expressions).toHaveLength(1);

      const expression = statement.expressions[0] as LiteralNode;
      expect(expression.type).toBe('Literal');
      expect(expression.value).toBe('Hello, World!');
    });

    test('should parse input statement', () => {
      const code = 'INPUT x';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);

      const statement = ast.body[0] as InputNode;
      expect(statement.type).toBe('Input');

      const target = statement.target as IdentifierNode;
      expect(target.type).toBe('Identifier');
      expect(target.name).toBe('x');
    });
  });

  describe('Expressions', () => {
    test('should parse binary expressions', () => {
      const code = 'x <- a + b * c';
      const ast = parseCode(code);

      const statement = ast.body[0] as AssignmentNode;
      const expression = statement.value as BinaryExpressionNode;

      expect(expression.type).toBe('BinaryExpression');
      expect(expression.operator).toBe('+');

      const left = expression.left as IdentifierNode;
      expect(left.name).toBe('a');

      const right = expression.right as BinaryExpressionNode;
      expect(right.operator).toBe('*');

      const rightLeft = right.left as IdentifierNode;
      expect(rightLeft.name).toBe('b');

      const rightRight = right.right as IdentifierNode;
      expect(rightRight.name).toBe('c');
    });

    test('should parse comparison expressions', () => {
      const code = 'x <- y > 5';
      const ast = parseCode(code);

      const statement = ast.body[0] as AssignmentNode;
      const expression = statement.value as BinaryExpressionNode;

      expect(expression.type).toBe('BinaryExpression');
      expect(expression.operator).toBe('>');

      const left = expression.left as IdentifierNode;
      expect(left.name).toBe('y');

      const right = expression.right as LiteralNode;
      expect(right.value).toBe(5);
    });

    test('should parse logical expressions', () => {
      const code = 'x <- a AND b OR NOT c';
      const ast = parseCode(code);

      const statement = ast.body[0] as AssignmentNode;
      const expression = statement.value as BinaryExpressionNode;

      expect(expression.type).toBe('BinaryExpression');
      expect(expression.operator).toBe('OR');
    });

    test('should parse parentheses in expressions', () => {
      const code = 'x <- (a + b) * c';
      const ast = parseCode(code);

      const statement = ast.body[0] as AssignmentNode;
      const expression = statement.value as BinaryExpressionNode;

      expect(expression.operator).toBe('*');

      const left = expression.left as BinaryExpressionNode;
      expect(left.operator).toBe('+');
    });
  });

  describe('Control structures', () => {
    test('should parse IF statement without ELSE', () => {
      const code = 'IF x > 0 THEN OUTPUT "Positive" ENDIF';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as IfNode;

      expect(statement.type).toBe('If');
      expect(statement.thenBranch).toHaveLength(1);
      expect(statement.elseBranch).toBeUndefined();

      const condition = statement.condition as BinaryExpressionNode;
      expect(condition.operator).toBe('>');

      const thenStatement = statement.thenBranch[0] as OutputNode;
      expect(thenStatement.type).toBe('Output');
    });

    test('should parse IF statement with ELSE', () => {
      const code = 'IF x > 0 THEN OUTPUT "Positive" ELSE OUTPUT "Non-positive" ENDIF';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as IfNode;

      expect(statement.type).toBe('If');
      expect(statement.thenBranch).toHaveLength(1);
      expect(statement.elseBranch).toHaveLength(1);

      const elseStatement = statement.elseBranch![0] as OutputNode;
      expect(elseStatement.type).toBe('Output');
    });

    test('should parse FOR loop', () => {
      const code = 'FOR i <- 1 TO 10 OUTPUT i NEXT i';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(2);
      const statement = ast.body[0] as ForNode;

      expect(statement.type).toBe('For');
      expect(statement.variable).toBe('i');
      expect(statement.body).toHaveLength(1);

      const start = statement.start as LiteralNode;
      expect(start.value).toBe(1);

      const end = statement.end as LiteralNode;
      expect(end.value).toBe(10);
    });

    test('should parse FOR loop with STEP', () => {
      const code = 'FOR i <- 1 TO 10 STEP 2 OUTPUT i NEXT i';
      const ast = parseCode(code);

      const statement = ast.body[0] as ForNode;
      expect(statement.type).toBe('For');

      const step = statement.step as LiteralNode;
      expect(step.value).toBe(2);
    });

    test('should parse WHILE loop', () => {
      const code = 'WHILE x > 0 OUTPUT x x <- x - 1 ENDWHILE';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as WhileNode;

      expect(statement.type).toBe('While');
      expect(statement.body).toHaveLength(3);

      const condition = statement.condition as BinaryExpressionNode;
      expect(condition.operator).toBe('>');
    });

    test('should parse REPEAT loop', () => {
      const code = 'REPEAT OUTPUT x x <- x - 1 UNTIL x <= 0';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as RepeatNode;

      expect(statement.type).toBe('Repeat');
      expect(statement.body).toHaveLength(3);

      const condition = statement.condition as BinaryExpressionNode;
      expect(condition.operator).toBe('<=');
    });
  });

  describe('Procedures and functions', () => {
    test('should parse procedure declaration', () => {
      const code = 'PROCEDURE Test() OUTPUT "Hello" ENDPROCEDURE';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as ProcedureDeclarationNode;

      expect(statement.type).toBe('ProcedureDeclaration');
      expect(statement.name).toBe('Test');
      expect(statement.parameters).toHaveLength(0);
      expect(statement.body).toHaveLength(1);
    });

    test('should parse procedure with parameters', () => {
      const code = 'PROCEDURE Add(x : INTEGER, y : INTEGER) OUTPUT x + y ENDPROCEDURE';
      const ast = parseCode(code);

      const statement = ast.body[0] as ProcedureDeclarationNode;
      expect(statement.name).toBe('Add');
      expect(statement.parameters).toHaveLength(2);

      const param1 = statement.parameters[0];
      expect(param1.name).toBe('x');
      expect(param1.dataType).toBe('INTEGER');
    });

    test('should parse function declaration', () => {
      const code = 'FUNCTION Add(x : INTEGER, y : INTEGER) RETURNS INTEGER RETURN x + y ENDFUNCTION';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as FunctionDeclarationNode;

      expect(statement.type).toBe('FunctionDeclaration');
      expect(statement.name).toBe('Add');
      expect(statement.returnType).toBe('INTEGER');
      expect(statement.parameters).toHaveLength(2);
    });

    test('should parse procedure call', () => {
      const code = 'CALL Test()';
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(1);
      const statement = ast.body[0] as CallStatementNode;

      expect(statement.type).toBe('CallStatement');
      expect(statement.name).toBe('Test');
      expect(statement.arguments).toHaveLength(0);
    });

    test('should parse procedure call with arguments', () => {
      const code = 'CALL Add(5, 10)';
      const ast = parseCode(code);

      const statement = ast.body[0] as CallStatementNode;
      expect(statement.name).toBe('Add');
      expect(statement.arguments).toHaveLength(2);

      const arg1 = statement.arguments[0] as LiteralNode;
      expect(arg1.value).toBe(5);

      const arg2 = statement.arguments[1] as LiteralNode;
      expect(arg2.value).toBe(10);
    });
  });

  describe('Error handling', () => {
    test('should handle incomplete statements gracefully', () => {
      const code = 'DECLARE x';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(0);
    });

    test('should handle malformed expressions', () => {
      const code = 'x <- +';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(0);
    });

    test('should handle unclosed control structures', () => {
      const code = 'IF x > 0 THEN OUTPUT "test"';
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(0);
    });
  });

  describe('Complex programs', () => {
    test('should parse multi-statement program', () => {
      const code = `
        DECLARE x : INTEGER
        DECLARE y : INTEGER
        x <- 10
        y <- 20
        OUTPUT x + y
      `;
      const ast = parseCode(code);

      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(5);
    });

    test('should parse nested control structures', () => {
      const code = `
        FOR i <- 1 TO 10
          IF i MOD 2 = 0 THEN
            OUTPUT i
          ENDIF
        NEXT i
      `;
      const ast = parseCode(code);

      expect(ast.body).toHaveLength(2);
      const forNode = ast.body[0] as ForNode;
      expect(forNode.body).toHaveLength(1);

      const ifNode = forNode.body[0] as IfNode;
      expect(ifNode.thenBranch).toHaveLength(1);
    });
  });
});
