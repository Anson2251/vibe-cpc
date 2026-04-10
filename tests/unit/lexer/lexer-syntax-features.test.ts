import { Lexer } from "../../../src/lexer/lexer";
import { TokenType } from "../../../src/lexer/tokens";

describe("Lexer syntax feature coverage", () => {
    test("tokenizes class-related keywords and member access", () => {
        const tokens = new Lexer("CLASS A INHERITS B PUBLIC PRIVATE x.y NEW").tokenize();
        const types = tokens.map((token) => token.type);

        expect(types).toEqual([
            TokenType.CLASS,
            TokenType.IDENTIFIER,
            TokenType.INHERITS,
            TokenType.IDENTIFIER,
            TokenType.PUBLIC,
            TokenType.PRIVATE,
            TokenType.IDENTIFIER,
            TokenType.DOT,
            TokenType.IDENTIFIER,
            TokenType.NEW,
            TokenType.EOF_TOKEN,
        ]);
    });

    test("tokenizes set/define/in syntax tokens", () => {
        const tokens = new Lexer("TYPE T = SET OF CHAR DEFINE V('A') : T IF 'A' IN V THEN ENDIF").tokenize();
        const types = tokens.map((token) => token.type);

        expect(types).toContain(TokenType.TYPE);
        expect(types).toContain(TokenType.SET);
        expect(types).toContain(TokenType.OF);
        expect(types).toContain(TokenType.DEFINE);
        expect(types).toContain(TokenType.IN);
    });

    test("distinguishes EOF keyword call from EOF_TOKEN terminator", () => {
        const tokens = new Lexer('EOF("a.txt")').tokenize();

        expect(tokens[0].type).toBe(TokenType.EOF);
        expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF_TOKEN);
    });
});
