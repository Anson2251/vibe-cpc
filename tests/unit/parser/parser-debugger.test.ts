import { Lexer } from "../../../src/lexer/lexer";
import { TokenType } from "../../../src/lexer/tokens";
import { Parser } from "../../../src/parser/parser";

describe("Parser DEBUGGER statement", () => {
    test("lexer recognizes DEBUGGER keyword", () => {
        const tokens = new Lexer("DEBUGGER").tokenize();
        expect(tokens[0].type).toBe(TokenType.DEBUGGER);
    });

    test("parser builds Debugger node", () => {
        const tokens = new Lexer("DEBUGGER").tokenize();
        const result = new Parser(tokens).parse();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.body).toHaveLength(1);
            expect(result.value.body[0].type).toBe("Debugger");
        }
    });
});
