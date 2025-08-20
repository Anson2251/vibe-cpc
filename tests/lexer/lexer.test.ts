import { Lexer } from '../../src/lexer/lexer';
import { TokenType, KEYWORD_TOKENS } from '../../src/lexer/tokens';

describe('Lexer', () => {
  describe('Basic tokens', () => {
    test('should tokenize simple variable declaration', () => {
      const code = 'DECLARE x : INTEGER';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.DECLARE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.INTEGER);
    });

    test('should tokenize assignment statement', () => {
      const code = 'x <- 42';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].type).toBe(TokenType.ASSIGNMENT);
      expect(tokens[2].type).toBe(TokenType.INTEGER_LITERAL);
    });

    test('should tokenize string literals', () => {
      const code = 'name <- "Hello World"';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[2].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[2].value).toBe('Hello World');
    });

    test('should tokenize char literals', () => {
      const code = "char <- 'A'";
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[2].type).toBe(TokenType.CHAR_LITERAL);
      expect(tokens[2].value).toBe("A");
    });
  });

  describe('Numbers', () => {
    test('should tokenize integer literals', () => {
      const code = '42 0 -5';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[0].value).toBe(42);
      expect(tokens[1].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[1].value).toBe(0);
      expect(tokens[2].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[2].value).toBe(-5);
    });

    test('should tokenize real literals', () => {
      const code = '3.14 0.5 -2.5';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();


      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.REAL_LITERAL);
      expect(tokens[0].value).toBe(3.14);
      expect(tokens[1].type).toBe(TokenType.REAL_LITERAL);
      expect(tokens[1].value).toBe(0.5);
      expect(tokens[2].type).toBe(TokenType.REAL_LITERAL);
      expect(tokens[2].value).toBe(-2.5);
    });
  });

  describe('Keywords', () => {
    test('should recognize all keywords', () => {
      const keywords = [
        'IF', 'THEN', 'ELSE', 'ENDIF', 'CASE', 'ENDCASE', 'OTHERWISE',
        'FOR', 'TO', 'NEXT', 'STEP', 'WHILE', 'ENDWHILE', 'REPEAT', 'UNTIL',
        'PROCEDURE', 'ENDPROCEDURE', 'FUNCTION', 'ENDFUNCTION',
        'DECLARE', 'CONSTANT', 'ARRAY', 'OF', 'TYPE', 'ENDTYPE',
        'CLASS', 'ENDCLASS', 'INHERITS', 'PUBLIC', 'PRIVATE', 'NEW',
        'BYVAL', 'BYREF', 'RETURNS', 'CALL', 'INPUT', 'OUTPUT',
        'OPENFILE', 'CLOSEFILE', 'READFILE', 'WRITEFILE', 'SEEK',
        'GETRECORD', 'PUTRECORD', 'EOF', 'FROM',
        'INTEGER', 'REAL', 'CHAR', 'STRING', 'BOOLEAN', 'DATE',
        'TRUE', 'FALSE', 'AND', 'OR', 'NOT'
      ];

      keywords.forEach(keyword => {
        const lexer = new Lexer(keyword);
        const tokens = lexer.tokenize();

        expect(tokens).toHaveLength(2);
        expect(tokens[0].type).toBe(KEYWORD_TOKENS[keyword]);
        expect(tokens[0].value).toBe(keyword);
      });
    });
  });

  describe('Operators', () => {
    test('should tokenize arithmetic operators', () => {
      const code = '+ - * / DIV MOD';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(7);
      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.MULTIPLY);
      expect(tokens[3].type).toBe(TokenType.DIVIDE);
      expect(tokens[4].type).toBe(TokenType.DIV);
      expect(tokens[5].type).toBe(TokenType.MOD);
    });

    test('should tokenize comparison operators', () => {
      const code = '= <> < > <= >=';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(7);
      expect(tokens[0].type).toBe(TokenType.EQUAL);
      expect(tokens[1].type).toBe(TokenType.NOT_EQUAL);
      expect(tokens[2].type).toBe(TokenType.LESS_THAN);
      expect(tokens[3].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[4].type).toBe(TokenType.LESS_EQUAL);
      expect(tokens[5].type).toBe(TokenType.GREATER_EQUAL);
    });

    test('should tokenize logical operators', () => {
      const code = 'AND OR NOT';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });

    test('should tokenize assignment operator', () => {
      const code = '<-';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.ASSIGNMENT);
      expect(tokens[0].value).toBe('<-');
    });
  });

  describe('Delimiters', () => {
    test('should tokenize parentheses and brackets', () => {
      const code = '()[]';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[1].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[2].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[3].type).toBe(TokenType.RIGHT_BRACKET);
    });

    test('should tokenize comma and colon', () => {
      const code = ', :';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.COMMA);
      expect(tokens[1].type).toBe(TokenType.COLON);
    });
  });

  describe('Identifiers', () => {
    test('should tokenize valid identifiers', () => {
      const code = 'variableName variable_name _variable variable123';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(5);
      tokens.slice(0, -1).forEach(token => {
        expect(token.type).toBe(TokenType.IDENTIFIER);
      });

      expect(tokens[0].value).toBe('variableName');
      expect(tokens[1].value).toBe('variable_name');
      expect(tokens[2].value).toBe('_variable');
      expect(tokens[3].value).toBe('variable123');
    });

    test('should not tokenize keywords as identifiers', () => {
      const code = 'IF THEN ELSE';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe(TokenType.IF);
      expect(tokens[1].type).toBe(TokenType.THEN);
      expect(tokens[2].type).toBe(TokenType.ELSE);
    });
  });

  describe('Comments', () => {
    test('should ignore single-line comments', () => {
      const code = 'DECLARE x : INTEGER // This is a comment';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.DECLARE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.INTEGER);
    });

    test('should ignore comment-only lines', () => {
      const code = '// This is a comment\nDECLARE x : INTEGER';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens[1].type).toBe(TokenType.DECLARE);
    });
  });

  describe('Complex expressions', () => {
    test('should tokenize complex arithmetic expression', () => {
      const code = 'result <- (a + b) * c DIV d MOD e';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(14);
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].type).toBe(TokenType.ASSIGNMENT);
      expect(tokens[2].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.PLUS);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[7].type).toBe(TokenType.MULTIPLY);
      expect(tokens[8].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[9].type).toBe(TokenType.DIV);
      expect(tokens[10].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[11].type).toBe(TokenType.MOD);
      expect(tokens[12].type).toBe(TokenType.IDENTIFIER);
    });

    test('should tokenize IF statement', () => {
      const code = 'IF x > 0 THEN OUTPUT "Positive" ENDIF';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(9);
      expect(tokens[0].type).toBe(TokenType.IF);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[3].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[4].type).toBe(TokenType.THEN);
      expect(tokens[5].type).toBe(TokenType.OUTPUT);
      expect(tokens[6].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[7].type).toBe(TokenType.ENDIF);
    });

    test('should tokenize FOR loop', () => {
      const code = 'FOR i <- 1 TO 10 STEP 2 OUTPUT i NEXT i';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(13);
      expect(tokens[0].type).toBe(TokenType.FOR);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.ASSIGNMENT);
      expect(tokens[3].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[4].type).toBe(TokenType.TO);
      expect(tokens[5].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[6].type).toBe(TokenType.STEP);
      expect(tokens[7].type).toBe(TokenType.INTEGER_LITERAL);
      expect(tokens[8].type).toBe(TokenType.OUTPUT);
      expect(tokens[9].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[10].type).toBe(TokenType.NEXT);
    });
  });

  describe('Error handling', () => {
    test('should handle empty input', () => {
      const code = '';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(1);
    });

    test('should handle whitespace-only input', () => {
      const code = '   \n  \t  ';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(1);
    });

    // test('should handle invalid characters gracefully', () => {
    //   const code = 'x <- @#$';
    //   const lexer = new Lexer(code);
    //   const tokens = lexer.tokenize();

    //   expect(tokens).toHaveLength(4);
    //   expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    //   expect(tokens[1].type).toBe(TokenType.ASSIGNMENT);
    //   expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    // });
  });
});
