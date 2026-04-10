import { Lexer } from "../../../src/lexer/lexer";
import { TokenType } from "../../../src/lexer/tokens";

describe("Lexer edge cases", () => {
    test("recognizes dot token separately from real numbers", () => {
        const tokens = new Lexer("a.b 12.34 12.").tokenize();
        const types = tokens.map((token) => token.type);

        expect(types).toEqual([
            TokenType.IDENTIFIER,
            TokenType.DOT,
            TokenType.IDENTIFIER,
            TokenType.REAL_LITERAL,
            TokenType.INTEGER_LITERAL,
            TokenType.DOT,
            TokenType.EOF_TOKEN,
        ]);
    });

    test("keeps identifier original case while keyword matching is case-insensitive", () => {
        const tokens = new Lexer("if MyVar").tokenize();

        expect(tokens[0].type).toBe(TokenType.IF);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe("MyVar");
    });

    test("throws on unterminated string literal", () => {
        expect(() => new Lexer('OUTPUT "abc').tokenize()).toThrow("Unterminated string");
    });

    test("throws on invalid character", () => {
        expect(() => new Lexer("x <- @").tokenize()).toThrow("Unexpected character: @");
    });
});
