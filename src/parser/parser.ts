/**
 * Parser for CAIE Pseudocode Interpreter
 *
 * This module implements the parser for the CAIE pseudocode language.
 * It converts a stream of tokens into an abstract syntax tree (AST).
 */

import { Token, TokenType } from "../lexer/tokens";
import {
    ProgramNode,
    StatementNode,
    ExpressionNode,
    DeclareStatementNode,
    AssignmentNode,
    IfNode,
    CaseNode,
    ForNode,
    WhileNode,
    RepeatNode,
    ProcedureDeclarationNode,
    FunctionDeclarationNode,
    CallStatementNode,
    InputNode,
    OutputNode,
    DebuggerNode,
    ReturnNode,
    OpenFileNode,
    CloseFileNode,
    ReadFileNode,
    WriteFileNode,
    SeekNode,
    GetRecordNode,
    PutRecordNode,
    TypeDeclarationNode,
    SetDeclarationNode,
    FieldDeclarationNode,
    ClassDeclarationNode,
    MethodDeclarationNode,
    BinaryExpressionNode,
    UnaryExpressionNode,
    IdentifierNode,
    LiteralNode,
    ArrayAccessNode,
    CallExpressionNode,
    MemberAccessNode,
    NewExpressionNode,
    SetLiteralNode,
    PointerDereferenceNode,
    AddressOfNode,
    DisposeStatementNode,
    ParameterNode,
} from "./ast-nodes";
import {
    PseudocodeType,
    ArrayTypeInfo,
    ArrayBound,
    UserDefinedTypeInfo,
    PointerTypeInfo,
    ParameterMode,
} from "../types";
import { SyntaxError } from "../errors";
import { ok, err } from "neverthrow";
import { ParseResult, toSyntaxError } from "../result";
import {
    parseOpenFileStatement,
    parseCloseFileStatement,
    parseReadFileStatement,
    parseWriteFileStatement,
    parseSeekStatement,
    parseGetRecordStatement,
    parsePutRecordStatement,
} from "./file-operations-parser";

/**
 * Parser class for generating AST from tokens
 */
export class Parser {
    private tokens: Token[];
    private current: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    /**
     * Parse the entire token stream into an AST
     */
    parse(): ParseResult<ProgramNode> {
        try {
            return ok(this.parseOrThrow());
        } catch (error: unknown) {
            return err(toSyntaxError(error, this.peek().line, this.peek().column));
        }
    }

    private parseOrThrow(): ProgramNode {
        const statements: StatementNode[] = [];

        while (!this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                statements.push(stmt);
            }
        }

        return {
            type: "Program",
            body: statements,
        };
    }

    /**
     * Parse a statement
     */
    private statement(): StatementNode | null {
        try {
            // Skip newlines
            while (this.match(TokenType.NEWLINE)); // Keep consuming newlines

            if (this.isAtEnd()) {
                return null;
            }

            const standaloneKeywordMessage = this.unexpectedStandaloneKeywordMessage(
                this.peek().type,
            );
            if (standaloneKeywordMessage !== null) {
                throw this.error(this.peek(), standaloneKeywordMessage);
            }

            // Check for different statement types
            if (this.match(TokenType.DECLARE)) {
                return this.declareStatement();
            }

            if (this.match(TokenType.IF)) {
                return this.ifStatement();
            }

            if (this.match(TokenType.CASE)) {
                return this.caseStatement();
            }

            if (this.match(TokenType.FOR)) {
                return this.forStatement();
            }

            if (this.match(TokenType.WHILE)) {
                return this.whileStatement();
            }

            if (this.match(TokenType.REPEAT)) {
                return this.repeatStatement();
            }

            if (this.match(TokenType.PROCEDURE)) {
                return this.procedureDeclaration();
            }

            if (this.match(TokenType.FUNCTION)) {
                return this.functionDeclaration();
            }

            if (this.match(TokenType.CALL)) {
                return this.callStatement();
            }

            if (this.match(TokenType.INPUT)) {
                return this.inputStatement();
            }

            if (this.match(TokenType.OUTPUT)) {
                return this.outputStatement();
            }

            if (this.match(TokenType.DEBUGGER)) {
                return this.debuggerStatement();
            }

            if (this.match(TokenType.RETURN)) {
                return this.returnStatement();
            }

            if (this.match(TokenType.OPENFILE)) {
                return this.openFileStatement();
            }

            if (this.match(TokenType.CLOSEFILE)) {
                return this.closeFileStatement();
            }

            if (this.match(TokenType.READFILE)) {
                return this.readFileStatement();
            }

            if (this.match(TokenType.WRITEFILE)) {
                return this.writeFileStatement();
            }

            if (this.match(TokenType.SEEK)) {
                return this.seekStatement();
            }

            if (this.match(TokenType.GETRECORD)) {
                return this.getRecordStatement();
            }

            if (this.match(TokenType.PUTRECORD)) {
                return this.putRecordStatement();
            }

            if (this.match(TokenType.TYPE)) {
                return this.typeDeclaration();
            }

            if (this.match(TokenType.DEFINE)) {
                return this.setDeclaration();
            }

            if (this.match(TokenType.CLASS)) {
                return this.classDeclaration();
            }

            if (this.match(TokenType.DISPOSE)) {
                return this.disposeStatement();
            }

            // If none of the above, try to parse as an assignment or expression statement
            return this.assignmentOrExpressionStatement();
        } catch (error) {
            // Synchronize on statement boundaries
            this.synchronize();
            const message = error instanceof Error ? error.message : String(error);
            throw new SyntaxError(message || "Unknown error", this.peek().line, this.peek().column);
        }
    }

    private tokenString(token: Token, message: string): string {
        if (typeof token.value !== "string") {
            throw this.error(token, message);
        }
        return token.value;
    }

    private isNumberLiteral(expression: ExpressionNode): expression is LiteralNode {
        return this.isLiteralNode(expression) && typeof expression.value === "number";
    }

    private isLiteralNode(expression: ExpressionNode): expression is LiteralNode {
        return expression.type === "Literal";
    }

    private isIdentifierExpression(expression: ExpressionNode): expression is IdentifierNode {
        return expression.type === "Identifier";
    }

    private isIdentifierNode(expression: ExpressionNode): expression is IdentifierNode {
        return expression.type === "Identifier";
    }

    private isUnaryExpressionNode(
        expression: ExpressionNode,
    ): expression is UnaryExpressionNode {
        return expression.type === "UnaryExpression";
    }

    private isInputTargetNode(
        expression: ExpressionNode,
    ): expression is IdentifierNode | ArrayAccessNode {
        return expression.type === "Identifier" || expression.type === "ArrayAccess";
    }

    private isAssignmentTargetNode(
        expression: ExpressionNode,
    ): expression is IdentifierNode | ArrayAccessNode | MemberAccessNode {
        return (
            expression.type === "Identifier" ||
            expression.type === "ArrayAccess" ||
            expression.type === "MemberAccess"
        );
    }

    private numberLiteralValue(expression: ExpressionNode, message: string): number {
        if (!this.isNumberLiteral(expression)) {
            throw this.error(this.peek(), message);
        }
        const literalValue = expression.value;
        if (typeof literalValue !== "number") {
            throw this.error(this.peek(), message);
        }
        return literalValue;
    }

    private tokenOperator(token: Token, message: string): string {
        if (typeof token.value !== "string") {
            throw this.error(token, message);
        }
        return token.value;
    }

    private describeToken(token: Token): string {
        if (token.type === TokenType.EOF_TOKEN) {
            return "end of input";
        }
        if (token.type === TokenType.NEWLINE) {
            return "newline";
        }
        if (typeof token.value === "string" && token.value.length > 0) {
            return `'${token.value}'`;
        }
        return token.type;
    }

    private addFoundTokenToMessage(message: string, token: Token): string {
        if (/\bfound\b/i.test(message)) {
            return message;
        }
        return `${message}, found ${this.describeToken(token)}`;
    }

    private unexpectedStandaloneKeywordMessage(tokenType: TokenType): string | null {
        switch (tokenType) {
            case TokenType.ELSE:
                return "Unexpected 'ELSE' without a matching IF block";
            case TokenType.ENDIF:
                return "Unexpected 'ENDIF' without a matching IF block";
            case TokenType.THEN:
                return "'THEN' can only be used after an IF condition";
            case TokenType.NEXT:
                return "Unexpected 'NEXT' without a matching FOR loop";
            case TokenType.ENDWHILE:
                return "Unexpected 'ENDWHILE' without a matching WHILE loop";
            case TokenType.UNTIL:
                return "Unexpected 'UNTIL' without a matching REPEAT block";
            case TokenType.ENDCASE:
                return "Unexpected 'ENDCASE' without a matching CASE block";
            case TokenType.ENDTYPE:
                return "Unexpected 'ENDTYPE' without a matching TYPE block";
            case TokenType.ENDPROCEDURE:
                return "Unexpected 'ENDPROCEDURE' without a matching PROCEDURE block";
            case TokenType.ENDFUNCTION:
                return "Unexpected 'ENDFUNCTION' without a matching FUNCTION block";
            case TokenType.ENDCLASS:
                return "Unexpected 'ENDCLASS' without a matching CLASS block";
            case TokenType.IF:
            case TokenType.CASE:
            case TokenType.OTHERWISE:
            case TokenType.FOR:
            case TokenType.TO:
            case TokenType.STEP:
            case TokenType.WHILE:
            case TokenType.REPEAT:
            case TokenType.PROCEDURE:
            case TokenType.FUNCTION:
            case TokenType.DECLARE:
            case TokenType.CONSTANT:
            case TokenType.ARRAY:
            case TokenType.OF:
            case TokenType.TYPE:
            case TokenType.DEFINE:
            case TokenType.SET:
            case TokenType.CLASS:
            case TokenType.INHERITS:
            case TokenType.PUBLIC:
            case TokenType.PRIVATE:
            case TokenType.NEW:
            case TokenType.DISPOSE:
            case TokenType.NULL:
            case TokenType.BYVAL:
            case TokenType.BYREF:
            case TokenType.RETURNS:
            case TokenType.RETURN:
            case TokenType.CALL:
            case TokenType.INPUT:
            case TokenType.OUTPUT:
            case TokenType.DEBUGGER:
            case TokenType.OPENFILE:
            case TokenType.CLOSEFILE:
            case TokenType.READFILE:
            case TokenType.WRITEFILE:
            case TokenType.SEEK:
            case TokenType.GETRECORD:
            case TokenType.PUTRECORD:
            case TokenType.EOF:
            case TokenType.IN:
            case TokenType.FROM:
            case TokenType.INTEGER:
            case TokenType.REAL:
            case TokenType.CHAR:
            case TokenType.STRING:
            case TokenType.BOOLEAN:
            case TokenType.DATE:
            case TokenType.INTEGER_LITERAL:
            case TokenType.REAL_LITERAL:
            case TokenType.STRING_LITERAL:
            case TokenType.CHAR_LITERAL:
            case TokenType.TRUE:
            case TokenType.FALSE:
            case TokenType.IDENTIFIER:
            case TokenType.PLUS:
            case TokenType.MINUS:
            case TokenType.MULTIPLY:
            case TokenType.DIVIDE:
            case TokenType.DIV:
            case TokenType.MOD:
            case TokenType.EQUAL:
            case TokenType.NOT_EQUAL:
            case TokenType.LESS_THAN:
            case TokenType.GREATER_THAN:
            case TokenType.LESS_EQUAL:
            case TokenType.GREATER_EQUAL:
            case TokenType.AND:
            case TokenType.OR:
            case TokenType.NOT:
            case TokenType.ASSIGNMENT:
            case TokenType.STRING_CONCAT:
            case TokenType.CARET:
            case TokenType.LEFT_PAREN:
            case TokenType.RIGHT_PAREN:
            case TokenType.LEFT_BRACKET:
            case TokenType.RIGHT_BRACKET:
            case TokenType.COMMA:
            case TokenType.COLON:
            case TokenType.DOT:
            case TokenType.COMMENT:
            case TokenType.NEWLINE:
            case TokenType.EOF_TOKEN:
                return null;
            default:
                return null;
        }
    }

    private tokenInteger(token: Token, message: string): number {
        if (typeof token.value === "number") {
            return Math.trunc(token.value);
        }
        if (typeof token.value === "string") {
            return parseInt(token.value, 10);
        }
        throw this.error(token, message);
    }

    private tokenReal(token: Token, message: string): number {
        if (typeof token.value === "number") {
            return token.value;
        }
        if (typeof token.value === "string") {
            return parseFloat(token.value);
        }
        throw this.error(token, message);
    }

    private isCallExpression(expression: ExpressionNode): expression is CallExpressionNode {
        return expression.type === "CallExpression";
    }

    private isBinaryExpression(expression: ExpressionNode): expression is BinaryExpressionNode {
        return expression.type === "BinaryExpression";
    }

    /**
     * Parse a DECLARE statement
     */
    private declareStatement(): DeclareStatementNode {
        const line = this.previous().line;
        const column = this.previous().column;

        // Get variable name
        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected variable name");
        const name = this.tokenString(nameToken, "Expected variable name to be text");

        this.consume(TokenType.COLON, "Expected ':' after variable name, before data type");

        const dataType = this.parseDataType();

        if (this.match(TokenType.ASSIGNMENT)) {
            throw this.error(this.peek(), "Assignment not allowed in DECLARE statement");
        }

        // Consume newline at the end of statement
        this.consumeNewline();

        return {
            type: "DeclareStatement",
            name,
            dataType,
            isConstant: false,
            initialValue: undefined,
            line,
            column,
        };
    }

    /**
     * Parse an IF statement
     */
    private ifStatement(): IfNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const condition = this.expression();
        this.consume(TokenType.THEN, "Expected 'THEN' after IF condition");
        this.consumeNewline();

        const thenBranch: StatementNode[] = [];
        while (!this.check(TokenType.ELSE) && !this.check(TokenType.ENDIF) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                thenBranch.push(stmt);
            }
        }

        let elseBranch: StatementNode[] | undefined;
        if (this.match(TokenType.ELSE)) {
            this.consumeNewline();
            elseBranch = [];
            while (!this.check(TokenType.ENDIF) && !this.isAtEnd()) {
                const stmt = this.statement();
                if (stmt) {
                    elseBranch.push(stmt);
                }
            }
        }

        this.consume(TokenType.ENDIF, "Expected 'ENDIF' to close IF statement");
        this.consumeNewline();

        return {
            type: "If",
            condition,
            thenBranch,
            elseBranch,
            line,
            column,
        };
    }

    /**
     * Parse a CASE statement
     */
    private caseStatement(): CaseNode {
        const line = this.previous().line;
        const column = this.previous().column;

        this.consume(TokenType.OF, "Expected 'OF' after CASE expression");
        const expression = this.expression();
        this.consumeNewline();

        const cases: { values: ExpressionNode[]; body: StatementNode[] }[] = [];
        let otherwise: StatementNode[] | undefined;

        while (!this.check(TokenType.ENDCASE) && !this.isAtEnd()) {
            // Check for OTHERWISE (default case)
            if (this.match(TokenType.OTHERWISE)) {
                this.consume(TokenType.COLON, "Expected ':' after OTHERWISE");
                this.consumeNewline();

                otherwise = [];
                while (!this.check(TokenType.ENDCASE) && !this.isAtEnd()) {
                    const stmt = this.statement();
                    if (stmt) {
                        otherwise.push(stmt);
                    }
                }

                break;
            }

            const caseValues: ExpressionNode[] = [];

            if (this.peekOffset(1).type === TokenType.TO) {
                // a range specified
                caseValues.push(this.expression());
                this.consume(TokenType.TO, "Expected 'TO' when a range is used in CASE statement");
                caseValues.push(this.expression());
            } else {
                // a single value specified
                caseValues.push(this.expression());
            }

            this.consume(TokenType.COLON, "Expected ':' after CASE values");
            this.consumeNewline();

            // Parse case body
            const caseBody: StatementNode[] = [];
            while (
                this.peekOffset(1).type !== TokenType.COLON &&
                this.peekOffset(1).type !== TokenType.TO &&
                !this.check(TokenType.CASE) &&
                !this.check(TokenType.ENDCASE) &&
                !this.check(TokenType.OTHERWISE) &&
                !this.isAtEnd()
            ) {
                const stmt = this.statement();
                if (stmt) {
                    caseBody.push(stmt);
                }
            }

            cases.push({
                values: caseValues,
                body: caseBody,
            });
        }

        this.consume(TokenType.ENDCASE, "Expected 'ENDCASE' to close CASE statement");
        this.consumeNewline();

        return {
            type: "Case",
            expression,
            cases,
            otherwise,
            line,
            column,
        };
    }

    /**
     * Parse a FOR statement
     */
    private forStatement(): ForNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const variableToken = this.consume(
            TokenType.IDENTIFIER,
            "Expected variable name in FOR loop",
        );
        const variable = this.tokenString(variableToken, "Expected FOR variable name to be text");

        this.consume(TokenType.ASSIGNMENT, "Expected '<-' after FOR variable");
        const start = this.expression();

        this.consume(TokenType.TO, "Expected 'TO' in FOR loop");
        const end = this.expression();

        let step: ExpressionNode | undefined;
        if (this.match(TokenType.STEP)) {
            step = this.expression();
        }

        this.consumeNewline();

        const body: StatementNode[] = [];
        while (!this.check(TokenType.NEXT) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume(TokenType.NEXT, "Expected 'NEXT' to close FOR loop");
        this.consumeNewline();

        return {
            type: "For",
            variable,
            start,
            end,
            step,
            body,
            line,
            column,
        };
    }

    /**
     * Parse a WHILE statement
     */
    private whileStatement(): WhileNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const condition = this.expression();
        this.consumeNewline();

        const body: StatementNode[] = [];
        while (!this.check(TokenType.ENDWHILE) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume(TokenType.ENDWHILE, "Expected 'ENDWHILE' to close WHILE loop");
        this.consumeNewline();

        return {
            type: "While",
            condition,
            body,
            line,
            column,
        };
    }

    /**
     * Parse a REPEAT statement
     */
    private repeatStatement(): RepeatNode {
        const line = this.previous().line;
        const column = this.previous().column;

        this.consumeNewline();

        const body: StatementNode[] = [];
        while (!this.check(TokenType.UNTIL) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume(TokenType.UNTIL, "Expected 'UNTIL' to close REPEAT loop");
        const condition = this.expression();
        this.consumeNewline();

        return {
            type: "Repeat",
            body,
            condition,
            line,
            column,
        };
    }

    /**
     * Parse a procedure declaration
     */
    private procedureDeclaration(): ProcedureDeclarationNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected procedure name");
        const name = this.tokenString(nameToken, "Expected procedure name to be text");

        this.consume(TokenType.LEFT_PAREN, "Expected '(' after procedure name");
        const parameters = this.parseParameters();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");
        this.consumeNewline();

        const body: StatementNode[] = [];
        while (!this.check(TokenType.ENDPROCEDURE) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume(
            TokenType.ENDPROCEDURE,
            "Expected 'ENDPROCEDURE' to close procedure declaration",
        );
        this.consumeNewline();

        return {
            type: "ProcedureDeclaration",
            name,
            parameters,
            body,
            line,
            column,
        };
    }

    /**
     * Parse a function declaration
     */
    private functionDeclaration(): FunctionDeclarationNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected function name");
        const name = this.tokenString(nameToken, "Expected function name to be text");

        this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name");
        const parameters = this.parseParameters();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");
        this.consumeOptionalNewline();
        this.consume(TokenType.RETURNS, "Expected 'RETURNS' in function declaration");
        const returnType = this.parseDataType();
        this.consumeNewline();

        const body: StatementNode[] = [];
        while (!this.check(TokenType.ENDFUNCTION) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume(TokenType.ENDFUNCTION, "Expected 'ENDFUNCTION' to close function declaration");
        this.consumeNewline();

        return {
            type: "FunctionDeclaration",
            name,
            parameters,
            returnType,
            body,
            line,
            column,
        };
    }

    /**
     * Parse parameters for procedures and functions
     */
    private parseParameters(): ParameterNode[] {
        const parameters: ParameterNode[] = [];

        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                const line = this.peek().line;
                const column = this.peek().column;

                let mode = ParameterMode.BY_VALUE;
                if (this.match(TokenType.BYVAL)) {
                    mode = ParameterMode.BY_VALUE;
                } else if (this.match(TokenType.BYREF)) {
                    mode = ParameterMode.BY_REFERENCE;
                }

                const nameToken = this.consume(TokenType.IDENTIFIER, "Expected parameter name");
                const name = this.tokenString(nameToken, "Expected parameter name to be text");

                this.consume(TokenType.COLON, "Expected ':' after parameter name");
                const dataType = this.parseDataType();

                parameters.push({
                    type: "Parameter",
                    name,
                    dataType,
                    mode,
                    line,
                    column,
                });
            } while (this.match(TokenType.COMMA));
        }

        return parameters;
    }

    /**
     * Parse a CALL statement
     */
    private callStatement(): CallStatementNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected procedure name");
        const name = this.tokenString(nameToken, "Expected procedure name to be text");

        const args: ExpressionNode[] = [];
        if (this.match(TokenType.LEFT_PAREN)) {
            if (!this.check(TokenType.RIGHT_PAREN)) {
                do {
                    args.push(this.expression());
                } while (this.match(TokenType.COMMA));
            }

            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments");
        }
        this.consumeNewline();

        return {
            type: "CallStatement",
            name,
            arguments: args,
            line,
            column,
        };
    }

    /**
     * Parse an INPUT statement
     */
    private inputStatement(): InputNode {
        const line = this.previous().line;
        const column = this.previous().column;

        let prompt: ExpressionNode | undefined;
        if (!this.check(TokenType.IDENTIFIER)) {
            prompt = this.expression();
        }

        const target = this.primary();
        if (!this.isInputTargetNode(target)) {
            throw this.error(this.peek(), "Expected variable name for INPUT statement");
        }
        this.consumeNewline();

        return {
            type: "Input",
            prompt,
            target,
            line,
            column,
        };
    }

    /**
     * Parse an OUTPUT statement
     */
    private outputStatement(): OutputNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const expressions: ExpressionNode[] = [];

        if (!this.check(TokenType.NEWLINE)) {
            do {
                expressions.push(this.expression());
            } while (this.match(TokenType.COMMA));
        }

        this.consumeNewline();

        return {
            type: "Output",
            expressions,
            line,
            column,
        };
    }

    private debuggerStatement(): DebuggerNode {
        const line = this.previous().line;
        const column = this.previous().column;
        this.consumeNewline();
        return {
            type: "Debugger",
            line,
            column,
        };
    }

    private disposeStatement(): DisposeStatementNode {
        const line = this.previous().line;
        const column = this.previous().column;
        const pointer = this.expression();
        this.consumeNewline();
        return {
            type: "DisposeStatement",
            pointer,
            line,
            column,
        };
    }

    /**
     * Parse a RETURN statement
     */
    private returnStatement(): ReturnNode {
        const line = this.previous().line;
        const column = this.previous().column;

        let value: ExpressionNode | undefined;
        if (!this.check(TokenType.NEWLINE)) {
            value = this.expression();
        }

        this.consumeNewline();

        return {
            type: "Return",
            value,
            line,
            column,
        };
    }

    /**
     * Parse an OPENFILE statement
     */
    private openFileStatement(): OpenFileNode {
        return parseOpenFileStatement(this.fileParserContext());
    }

    /**
     * Parse a CLOSEFILE statement
     */
    private closeFileStatement(): CloseFileNode {
        return parseCloseFileStatement(this.fileParserContext());
    }

    /**
     * Parse a READFILE statement
     */
    private readFileStatement(): ReadFileNode {
        return parseReadFileStatement(this.fileParserContext());
    }

    /**
     * Parse a WRITEFILE statement
     */
    private writeFileStatement(): WriteFileNode {
        return parseWriteFileStatement(this.fileParserContext());
    }

    /**
     * Parse a SEEK statement
     */
    private seekStatement(): SeekNode {
        return parseSeekStatement(this.fileParserContext());
    }

    /**
     * Parse a GETRECORD statement
     */
    private getRecordStatement(): GetRecordNode {
        return parseGetRecordStatement(this.fileParserContext());
    }

    /**
     * Parse a PUTRECORD statement
     */
    private putRecordStatement(): PutRecordNode {
        return parsePutRecordStatement(this.fileParserContext());
    }

    private fileParserContext() {
        return {
            previousLine: () => this.previous().line,
            previousColumn: () => this.previous().column,
            expression: () => this.expression(),
            primary: () => this.primary(),
            check: (type: TokenType) => this.check(type),
            match: (type: TokenType) => this.match(type),
            consume: (type: TokenType, message: string) => this.consume(type, message),
            consumeNewline: () => {
                this.consumeNewline();
            },
            error: (token: Token, message: string) => this.error(token, message),
        };
    }

    /**
     * Parse a TYPE declaration
     */
    private typeDeclaration(): TypeDeclarationNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected type name");
        const name = this.tokenString(nameToken, "Expected type name to be text");
        if (this.match(TokenType.EQUAL)) {
            if (this.match(TokenType.SET)) {
                this.consume(TokenType.OF, "Expected 'OF' after SET");
                const elementType = this.parseDataType();
                if (typeof elementType !== "string") {
                    throw this.error(this.peek(), "SET element type must be a primitive type");
                }
                this.consumeNewline();

                return {
                    type: "TypeDeclaration",
                    name,
                    fields: [],
                    setElementType: elementType,
                    line,
                    column,
                };
            }

            if (this.check(TokenType.CARET)) {
                const pointerType = this.parseDataType();
                this.consumeNewline();

                return {
                    type: "TypeDeclaration",
                    name,
                    fields: [],
                    pointerType,
                    line,
                    column,
                };
            }

            this.consume(TokenType.LEFT_PAREN, "Expected '(' after '=' in enum declaration");
            const enumValues: string[] = [];
            do {
                const valueToken = this.consume(
                    TokenType.IDENTIFIER,
                    "Expected enum member identifier",
                );
                enumValues.push(this.tokenString(valueToken, "Expected enum member to be text"));
            } while (this.match(TokenType.COMMA));
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after enum declaration values");
            this.consumeNewline();

            return {
                type: "TypeDeclaration",
                name,
                fields: [],
                enumValues,
                line,
                column,
            };
        }

        this.consumeNewline();

        const fields: FieldDeclarationNode[] = [];
        while (!this.check(TokenType.ENDTYPE) && !this.isAtEnd()) {
            const fieldLine = this.peek().line;
            const fieldColumn = this.peek().column;

            if (this.match(TokenType.DECLARE)) {
                // optional DECLARE keyword in type fields
            }

            const fieldNameToken = this.consume(TokenType.IDENTIFIER, "Expected field name");
            const fieldName = this.tokenString(fieldNameToken, "Expected field name to be text");

            this.consume(TokenType.COLON, "Expected ':' after field name");
            const dataType = this.parseDataType();
            this.consumeNewline();

            fields.push({
                type: "FieldDeclaration",
                name: fieldName,
                dataType,
                line: fieldLine,
                column: fieldColumn,
            });
        }

        this.consume(TokenType.ENDTYPE, "Expected 'ENDTYPE' to close type declaration");
        this.consumeNewline();

        return {
            type: "TypeDeclaration",
            name,
            fields,
            line,
            column,
        };
    }

    private setDeclaration(): SetDeclarationNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(
            TokenType.IDENTIFIER,
            "Expected set variable name after DEFINE",
        );
        const name = this.tokenString(nameToken, "Expected set name to be text");

        this.consume(TokenType.LEFT_PAREN, "Expected '(' after set name");
        const values: ExpressionNode[] = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                values.push(this.expression());
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after set values");
        this.consume(TokenType.COLON, "Expected ':' before set type name");
        const typeToken = this.consume(TokenType.IDENTIFIER, "Expected set type name");
        this.consumeNewline();

        return {
            type: "SetDeclaration",
            name,
            setTypeName: this.tokenString(typeToken, "Expected set type name to be text"),
            values,
            line,
            column,
        };
    }

    /**
     * Parse a CLASS declaration
     */
    private classDeclaration(): ClassDeclarationNode {
        const line = this.previous().line;
        const column = this.previous().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected class name");
        const name = this.tokenString(nameToken, "Expected class name to be text");

        let inherits: string | undefined;
        if (this.match(TokenType.INHERITS)) {
            const parentToken = this.consume(TokenType.IDENTIFIER, "Expected parent class name");
            inherits = this.tokenString(parentToken, "Expected parent class name to be text");
        }

        this.consumeNewline();

        const fields: FieldDeclarationNode[] = [];
        const methods: MethodDeclarationNode[] = [];

        while (!this.check(TokenType.ENDCLASS) && !this.isAtEnd()) {
            if (this.match(TokenType.PUBLIC) || this.match(TokenType.PRIVATE)) {
                const visibility = this.previous().value === "PUBLIC" ? "PUBLIC" : "PRIVATE";

                if (this.check(TokenType.IDENTIFIER) && this.peek().value !== "DECLARE") {
                    // Method declaration
                    const method = this.methodDeclaration(visibility);
                    methods.push(method);
                } else {
                    // Field declaration
                    this.consume(TokenType.DECLARE, "Expected 'DECLARE' for field declaration");
                    const fieldNameToken = this.consume(
                        TokenType.IDENTIFIER,
                        "Expected field name",
                    );
                    const fieldName = this.tokenString(
                        fieldNameToken,
                        "Expected field name to be text",
                    );

                    this.consume(TokenType.COLON, "Expected ':' after field name");
                    const dataType = this.parseDataType();
                    this.consumeNewline();

                    fields.push({
                        type: "FieldDeclaration",
                        name: fieldName,
                        dataType,
                        line: fieldNameToken.line,
                        column: fieldNameToken.column,
                    });
                }
            } else {
                // Default visibility is PRIVATE
                if (this.check(TokenType.IDENTIFIER) && this.peek().value !== "DECLARE") {
                    // Method declaration
                    const method = this.methodDeclaration("PRIVATE");
                    methods.push(method);
                } else {
                    // Field declaration
                    this.consume(TokenType.DECLARE, "Expected 'DECLARE' for field declaration");
                    const fieldNameToken = this.consume(
                        TokenType.IDENTIFIER,
                        "Expected field name",
                    );
                    const fieldName = this.tokenString(
                        fieldNameToken,
                        "Expected field name to be text",
                    );

                    this.consume(TokenType.COLON, "Expected ':' after field name");
                    const dataType = this.parseDataType();
                    this.consumeNewline();

                    fields.push({
                        type: "FieldDeclaration",
                        name: fieldName,
                        dataType,
                        line: fieldNameToken.line,
                        column: fieldNameToken.column,
                    });
                }
            }
        }

        this.consume(TokenType.ENDCLASS, "Expected 'ENDCLASS' to close class declaration");
        this.consumeNewline();

        return {
            type: "ClassDeclaration",
            name,
            inherits,
            fields,
            methods,
            line,
            column,
        };
    }

    /**
     * Parse a method declaration within a class
     */
    private methodDeclaration(visibility: "PUBLIC" | "PRIVATE"): MethodDeclarationNode {
        const line = this.peek().line;
        const column = this.peek().column;

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected method name");
        const name = this.tokenString(nameToken, "Expected method name to be text");

        this.consume(TokenType.LEFT_PAREN, "Expected '(' after method name");
        const parameters = this.parseParameters();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");

        let returnType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo | PointerTypeInfo | undefined;
        if (this.match(TokenType.RETURNS)) {
            returnType = this.parseDataType();
        }

        this.consumeNewline();

        const body: StatementNode[] = [];
        while (
            !this.check(TokenType.ENDCLASS) &&
            !this.check(TokenType.PUBLIC) &&
            !this.check(TokenType.PRIVATE) &&
            !this.isAtEnd()
        ) {
            const stmt = this.statement();
            if (stmt) {
                body.push(stmt);
            }
        }

        return {
            type: "MethodDeclaration",
            name,
            visibility,
            parameters,
            returnType,
            body,
            line,
            column,
        };
    }

    /**
     * Parse an assignment or expression statement
     */
    private assignmentOrExpressionStatement(): StatementNode {
        const expr = this.expression();

        if (this.match(TokenType.ASSIGNMENT)) {
            // Assignment statement
            const value = this.expression();
            this.consumeNewline();

            const assignment: AssignmentNode = {
                type: "Assignment",
                target: expr,
                value,
                line: expr.line,
                column: expr.column,
            };
            return assignment;
        }

        if (this.check(TokenType.EQUAL) && this.isAssignmentTargetNode(expr)) {
            throw this.error(this.peek(), "Use '<-' for assignment instead of '='");
        }

        if (
            this.isBinaryExpression(expr) &&
            expr.operator === "=" &&
            this.isAssignmentTargetNode(expr.left)
        ) {
            throw this.error(this.previous(), "Use '<-' for assignment instead of '='");
        }

        // Expression statement (e.g., function call)
        this.consumeNewline();

        // If it's a call expression, convert it to a call statement
        if (this.isCallExpression(expr)) {
            const callStatement: CallStatementNode = {
                type: "CallStatement",
                name: expr.name,
                arguments: expr.arguments,
                line: expr.line,
                column: expr.column,
            };
            return callStatement;
        }

        // Otherwise, it's just an expression statement
        return expr;
    }

    /**
     * Parse an expression
     */
    private expression(): ExpressionNode {
        return this.logicalOr();
    }

    /**
     * Parse a logical OR expression
     */
    private logicalOr(): ExpressionNode {
        let expr = this.logicalAnd();

        while (this.match(TokenType.OR)) {
            const operator = this.tokenOperator(this.previous(), "Expected OR operator");
            const right = this.logicalAnd();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse a logical AND expression
     */
    private logicalAnd(): ExpressionNode {
        let expr = this.equality();

        while (this.match(TokenType.AND)) {
            const operator = this.tokenOperator(this.previous(), "Expected AND operator");
            const right = this.equality();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse an equality expression
     */
    private equality(): ExpressionNode {
        let expr = this.comparison();

        while (this.match(TokenType.EQUAL) || this.match(TokenType.NOT_EQUAL)) {
            const operator = this.tokenOperator(this.previous(), "Expected equality operator");
            const right = this.comparison();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse a comparison expression
     */
    private comparison(): ExpressionNode {
        let expr = this.term();

        while (
            this.match(TokenType.GREATER_THAN) ||
            this.match(TokenType.GREATER_EQUAL) ||
            this.match(TokenType.LESS_THAN) ||
            this.match(TokenType.LESS_EQUAL) ||
            this.match(TokenType.IN)
        ) {
            const operator = this.tokenOperator(this.previous(), "Expected comparison operator");
            const right = this.term();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse a term expression
     */
    private term(): ExpressionNode {
        let expr = this.factor();

        while (
            this.match(TokenType.PLUS) ||
            this.match(TokenType.MINUS) ||
            this.match(TokenType.STRING_CONCAT)
        ) {
            const operator = this.tokenOperator(this.previous(), "Expected term operator");
            const right = this.factor();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse a factor expression
     */
    private factor(): ExpressionNode {
        let expr = this.unary();

        while (
            this.match(TokenType.MULTIPLY) ||
            this.match(TokenType.DIVIDE) ||
            this.match(TokenType.DIV) ||
            this.match(TokenType.MOD)
        ) {
            const operator = this.tokenOperator(this.previous(), "Expected factor operator");
            const right = this.unary();
            const binaryExpression: BinaryExpressionNode = {
                type: "BinaryExpression",
                operator,
                left: expr,
                right,
                line: expr.line,
                column: expr.column,
            };
            expr = binaryExpression;
        }

        return expr;
    }

    /**
     * Parse a unary expression
     */
    private unary(): ExpressionNode {
        if (this.match(TokenType.MINUS) || this.match(TokenType.NOT)) {
            const operator = this.tokenOperator(this.previous(), "Expected unary operator");
            const right = this.unary();
            const unaryExpression: UnaryExpressionNode = {
                type: "UnaryExpression",
                operator,
                operand: right,
                line: this.previous().line,
                column: this.previous().column,
            };
            return unaryExpression;
        }

        return this.primary();
    }

    private parsePostfixExpression(): ExpressionNode {
        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected variable name");
        const identifierExpression: IdentifierNode = {
            type: "Identifier",
            name: this.tokenString(nameToken, "Expected variable name"),
            line: nameToken.line,
            column: nameToken.column,
        };
        return this.applyPostfix(identifierExpression);
    }

    private applyPostfix(expr: ExpressionNode): ExpressionNode {
        while (true) {
            if (this.isIdentifierNode(expr) && this.match(TokenType.LEFT_PAREN)) {
                const args: ExpressionNode[] = [];

                if (!this.check(TokenType.RIGHT_PAREN)) {
                    do {
                        args.push(this.expression());
                    } while (this.match(TokenType.COMMA));
                }

                const closingParen = this.consume(
                    TokenType.RIGHT_PAREN,
                    "Expected ')' after arguments",
                );

                const callExpression: CallExpressionNode = {
                    type: "CallExpression",
                    name: expr.name,
                    arguments: args,
                    line: closingParen.line,
                    column: closingParen.column,
                };
                expr = callExpression;
                continue;
            }

            if (this.match(TokenType.LEFT_BRACKET)) {
                const indices: ExpressionNode[] = [];

                do {
                    indices.push(this.expression());
                } while (this.match(TokenType.COMMA));

                const closingBracket = this.consume(
                    TokenType.RIGHT_BRACKET,
                    "Expected ']' after array indices",
                );

                const arrayAccess: ArrayAccessNode = {
                    type: "ArrayAccess",
                    array: expr,
                    indices,
                    line: closingBracket.line,
                    column: closingBracket.column,
                };
                expr = arrayAccess;
                continue;
            }

            if (this.match(TokenType.DOT)) {
                const fieldToken = this.consume(
                    TokenType.IDENTIFIER,
                    "Expected field name after '.'",
                );
                const memberExpression: MemberAccessNode = {
                    type: "MemberAccess",
                    object: expr,
                    field: this.tokenString(fieldToken, "Expected field name after '.'"),
                    line: fieldToken.line,
                    column: fieldToken.column,
                };
                expr = memberExpression;
                continue;
            }

            if (this.match(TokenType.CARET)) {
                const deref: PointerDereferenceNode = {
                    type: "PointerDereference",
                    pointer: expr,
                    line: this.previous().line,
                    column: this.previous().column,
                };
                expr = deref;
                continue;
            }

            break;
        }

        return expr;
    }

    private primary(): ExpressionNode {
        if (this.match(TokenType.NULL)) {
            const literal: LiteralNode = {
                type: "Literal",
                value: 0,
                dataType: PseudocodeType.INTEGER,
                line: this.previous().line,
                column: this.previous().column,
            };
            return literal;
        }

        if (this.match(TokenType.CARET)) {
            const target = this.parsePostfixExpression();
            const addressOf: AddressOfNode = {
                type: "AddressOf",
                target,
                line: target.line,
                column: target.column,
            };
            return addressOf;
        }

        if (this.match(TokenType.TRUE)) {
            const literal: LiteralNode = {
                type: "Literal",
                value: true,
                dataType: PseudocodeType.BOOLEAN,
                line: this.previous().line,
                column: this.previous().column,
            };
            return literal;
        }

        if (this.match(TokenType.FALSE)) {
            const literal: LiteralNode = {
                type: "Literal",
                value: false,
                dataType: PseudocodeType.BOOLEAN,
                line: this.previous().line,
                column: this.previous().column,
            };
            return literal;
        }

        if (this.match(TokenType.INTEGER_LITERAL)) {
            const token = this.previous();
            const literal: LiteralNode = {
                type: "Literal",
                value: this.tokenInteger(token, "Expected integer literal"),
                dataType: PseudocodeType.INTEGER,
                line: token.line,
                column: token.column,
            };
            return literal;
        }

        if (this.match(TokenType.REAL_LITERAL)) {
            const token = this.previous();
            const literal: LiteralNode = {
                type: "Literal",
                value: this.tokenReal(token, "Expected real literal"),
                dataType: PseudocodeType.REAL,
                line: token.line,
                column: token.column,
            };
            return literal;
        }

        if (this.match(TokenType.STRING_LITERAL)) {
            const token = this.previous();
            const literal: LiteralNode = {
                type: "Literal",
                value: token.value,
                dataType: PseudocodeType.STRING,
                line: token.line,
                column: token.column,
            };
            return literal;
        }

        if (this.match(TokenType.CHAR_LITERAL)) {
            const token = this.previous();
            const literal: LiteralNode = {
                type: "Literal",
                value: token.value,
                dataType: PseudocodeType.CHAR,
                line: token.line,
                column: token.column,
            };
            return literal;
        }

        if (this.match(TokenType.IDENTIFIER)) {
            const identifierToken = this.previous();
            const name = this.tokenString(identifierToken, "Expected identifier");

            const identifierExpression: IdentifierNode = {
                type: "Identifier",
                name,
                line: identifierToken.line,
                column: identifierToken.column,
            };

            return this.applyPostfix(identifierExpression);
        }

        if (this.match(TokenType.LEFT_PAREN)) {
            const expr = this.expression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression");
            return expr;
        }

        if (this.match(TokenType.LEFT_BRACKET)) {
            const elements: ExpressionNode[] = [];
            if (!this.check(TokenType.RIGHT_BRACKET)) {
                do {
                    elements.push(this.expression());
                } while (this.match(TokenType.COMMA));
            }
            const closingBracket = this.consume(
                TokenType.RIGHT_BRACKET,
                "Expected ']' after set literal",
            );

            const setLiteral: SetLiteralNode = {
                type: "SetLiteral",
                elements,
                line: closingBracket.line,
                column: closingBracket.column,
            };
            return setLiteral;
        }

        if (this.match(TokenType.NEW)) {
            const classNameToken = this.consume(
                TokenType.IDENTIFIER,
                "Expected class name after NEW",
            );
            const className = this.tokenString(classNameToken, "Expected class name after NEW");

            this.consume(TokenType.LEFT_PAREN, "Expected '(' after class name");
            const args: ExpressionNode[] = [];

            if (!this.check(TokenType.RIGHT_PAREN)) {
                do {
                    args.push(this.expression());
                } while (this.match(TokenType.COMMA));
            }

            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments");

            const newExpression: NewExpressionNode = {
                type: "NewExpression",
                className,
                arguments: args,
                line: this.previous().line,
                column: this.previous().column,
            };
            return newExpression;
        }

        if (this.match(TokenType.EOF)) {
            this.consume(TokenType.LEFT_PAREN, "Expected '(' after EOF");
            const args: ExpressionNode[] = [];
            if (!this.check(TokenType.RIGHT_PAREN)) {
                do {
                    args.push(this.expression());
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after EOF arguments");

            const callExpression: CallExpressionNode = {
                type: "CallExpression",
                name: "EOF",
                arguments: args,
                line: this.previous().line,
                column: this.previous().column,
            };
            return callExpression;
        }

        throw this.error(
            this.peek(),
            `Expected expression, found ${this.describeToken(this.peek())}`,
        );
    }

    /**
     * Parse a data type
     */
    private parseDataType(): PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo | PointerTypeInfo {
        if (this.match(TokenType.ARRAY)) {
            return this.parseArrayType();
        }

        if (this.match(TokenType.CARET)) {
            const pointedType = this.parseDataType();
            const pointedName = typeof pointedType === "string"
                ? pointedType
                : "fields" in pointedType || "kind" in pointedType
                    ? (pointedType as { name: string }).name
                    : "UNKNOWN";
            return {
                kind: "POINTER",
                name: `^${pointedName}`,
                pointedType,
            };
        }

        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.previous();
            return {
                name: this.tokenString(token, "Expected type identifier"),
                fields: {},
            };
        }

        const token = this.consumeLike(
            [
                TokenType.STRING,
                TokenType.CHAR,
                TokenType.INTEGER,
                TokenType.REAL,
                TokenType.BOOLEAN,
                TokenType.DATE,
            ],
            `Expected data type, found "${String(this.peek().value)}"`,
        );
        const typeName = this.tokenString(token, "Expected data type token").toUpperCase();

        switch (typeName) {
            case "INTEGER":
                return PseudocodeType.INTEGER;
            case "REAL":
                return PseudocodeType.REAL;
            case "CHAR":
                return PseudocodeType.CHAR;
            case "STRING":
                return PseudocodeType.STRING;
            case "BOOLEAN":
                return PseudocodeType.BOOLEAN;
            case "DATE":
                return PseudocodeType.DATE;
            default:
                throw this.error(this.peek(), `Expected data type, found "${String(token.value)}"`);
        }
    }

    private integerLiteralValue(expression: ExpressionNode, message: string): number {
        if (this.isNumberLiteral(expression)) {
            const literalValue = expression.value;
            if (typeof literalValue === "number" && Number.isInteger(literalValue)) {
                return literalValue;
            }
        }

        if (
            this.isUnaryExpressionNode(expression) &&
            expression.operator === "-" &&
            this.isNumberLiteral(expression.operand)
        ) {
            const literalValue = expression.operand.value;
            if (typeof literalValue === "number" && Number.isInteger(literalValue)) {
                return -literalValue;
            }
        }

        throw this.error(this.peek(), message);
    }

    private integerBoundValue(expression: ExpressionNode, message: string): number | string {
        if (this.isIdentifierExpression(expression)) {
            return expression.name;
        }

        return this.integerLiteralValue(expression, message);
    }

    private parseArrayType(): ArrayTypeInfo {
        const bounds: ArrayBound[] = [];
        this.consume(TokenType.LEFT_BRACKET, "Expected '[' for array bounds");

        while (!this.check(TokenType.RIGHT_BRACKET)) {
            const lowerExpr = this.expression();
            const lower = this.integerBoundValue(
                lowerExpr,
                "Array bounds must be integer literals or integer variables",
            );

            this.consume(TokenType.COLON, "Expected ':' between array bounds");

            const upperExpr = this.expression();
            const upper = this.integerBoundValue(
                upperExpr,
                "Array bounds must be integer literals or integer variables",
            );
            bounds.push({ lower, upper });

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array bounds");
        this.consume(TokenType.OF, "Expected 'OF' after ARRAY");
        const elementType = this.parseDataType();

        return { elementType, bounds };
    }

    private consumeOptionalNewline(): void {
        while (this.match(TokenType.NEWLINE)) {
            continue;
        }
    }

    /**
     * Consume a newline token
     */
    private consumeNewline(): void {
        this.match(TokenType.NEWLINE);
    }

    /**
     * Check if the current token matches the given type
     */
    private match(type: TokenType): boolean {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * Check if the current token is of the given type
     */
    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    /**
     * Advance to the next token
     */
    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    /**
     * Check if we're at the end of the token stream
     */
    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF_TOKEN;
    }

    /**
     * Get the current token
     */
    private peek(): Token {
        return this.tokens[this.current];
    }

    private peekOffset(offset: number): Token {
        const index = this.current + offset;
        if (index >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1];
        }
        return this.tokens[index];
    }

    /**
     * Get the previous token
     */
    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    /**
     * Consume a token of the given type or throw an error
     */
    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();

        throw this.error(this.peek(), this.addFoundTokenToMessage(message, this.peek()));
    }

    /*
     * Consume a token of one of the given types or throw an error
     */
    private consumeLike(types: TokenType[], message: string): Token {
        if (types.includes(this.peek().type)) return this.advance();

        throw this.error(this.peek(), this.addFoundTokenToMessage(message, this.peek()));
    }

    /**
     * Create an error at the given token
     */
    private error(token: Token, message: string): SyntaxError {
        return new SyntaxError(message, token.line, token.column);
    }

    /**
     * Synchronize the parser after an error
     */
    private synchronize(): void {
        this.advance();

        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.NEWLINE) return;

            const statementStartTokens = new Set<TokenType>([
                TokenType.DECLARE,
                TokenType.IF,
                TokenType.FOR,
                TokenType.WHILE,
                TokenType.REPEAT,
                TokenType.PROCEDURE,
                TokenType.FUNCTION,
                TokenType.INPUT,
                TokenType.OUTPUT,
                TokenType.OPENFILE,
                TokenType.CLOSEFILE,
                TokenType.RETURNS,
                TokenType.CALL,
            ]);

            if (statementStartTokens.has(this.peek().type)) {
                return;
            }

            this.advance();
        }
    }
}
