/**
 * Token Definitions for CAIE Pseudocode Lexer
 *
 * This module defines all token types and the Token class for the CAIE pseudocode language.
 */

/**
 * Token type enumeration for all CAIE pseudocode tokens
 */
export enum TokenType {
	// Keywords
	IF = 'IF',
	THEN = 'THEN',
	ELSE = 'ELSE',
	ENDIF = 'ENDIF',
	CASE = 'CASE',
	ENDCASE = 'ENDCASE',
	OTHERWISE = 'OTHERWISE',
	FOR = 'FOR',
	TO = 'TO',
	NEXT = 'NEXT',
	STEP = 'STEP',
	WHILE = 'WHILE',
	ENDWHILE = 'ENDWHILE',
	REPEAT = 'REPEAT',
	UNTIL = 'UNTIL',
	PROCEDURE = 'PROCEDURE',
	ENDPROCEDURE = 'ENDPROCEDURE',
	FUNCTION = 'FUNCTION',
	ENDFUNCTION = 'ENDFUNCTION',
	DECLARE = 'DECLARE',
	CONSTANT = 'CONSTANT',
	ARRAY = 'ARRAY',
	OF = 'OF',
	TYPE = 'TYPE',
	ENDTYPE = 'ENDTYPE',
	CLASS = 'CLASS',
	ENDCLASS = 'ENDCLASS',
	INHERITS = 'INHERITS',
	PUBLIC = 'PUBLIC',
	PRIVATE = 'PRIVATE',
	NEW = 'NEW',
	BYVAL = 'BYVAL',
	BYREF = 'BYREF',
	RETURNS = 'RETURNS',
	CALL = 'CALL',
	INPUT = 'INPUT',
	OUTPUT = 'OUTPUT',
	OPENFILE = 'OPENFILE',
	CLOSEFILE = 'CLOSEFILE',
	READFILE = 'READFILE',
	WRITEFILE = 'WRITEFILE',
	SEEK = 'SEEK',
	GETRECORD = 'GETRECORD',
	PUTRECORD = 'PUTRECORD',
	EOF = 'EOF',
	FROM = 'FROM',

	// Data types
	INTEGER = 'INTEGER',
	REAL = 'REAL',
	CHAR = 'CHAR',
	STRING = 'STRING',
	BOOLEAN = 'BOOLEAN',
	DATE = 'DATE',

	// Literals
	INTEGER_LITERAL = 'INTEGER_LITERAL',
	REAL_LITERAL = 'REAL_LITERAL',
	STRING_LITERAL = 'STRING_LITERAL',
	CHAR_LITERAL = 'CHAR_LITERAL',
	TRUE = 'TRUE',
	FALSE = 'FALSE',

	// Identifiers
	IDENTIFIER = 'IDENTIFIER',

	// Operators
	PLUS = 'PLUS',
	MINUS = 'MINUS',
	MULTIPLY = 'MULTIPLY',
	DIVIDE = 'DIVIDE',
	DIV = 'DIV',
	MOD = 'MOD',
	EQUAL = 'EQUAL',
	NOT_EQUAL = 'NOT_EQUAL',
	LESS_THAN = 'LESS_THAN',
	GREATER_THAN = 'GREATER_THAN',
	LESS_EQUAL = 'LESS_EQUAL',
	GREATER_EQUAL = 'GREATER_EQUAL',
	AND = 'AND',
	OR = 'OR',
	NOT = 'NOT',
	ASSIGNMENT = 'ASSIGNMENT',

	// Delimiters
	LEFT_PAREN = 'LEFT_PAREN',
	RIGHT_PAREN = 'RIGHT_PAREN',
	LEFT_BRACKET = 'LEFT_BRACKET',
	RIGHT_BRACKET = 'RIGHT_BRACKET',
	COMMA = 'COMMA',
	COLON = 'COLON',

	// Special
	COMMENT = 'COMMENT',
	NEWLINE = 'NEWLINE',
	EOF_TOKEN = 'EOF_TOKEN'
}

/**
 * Mapping of keyword strings to token types
 */
export const KEYWORD_TOKENS: Record<string, TokenType> = {
	'IF': TokenType.IF,
	'THEN': TokenType.THEN,
	'ELSE': TokenType.ELSE,
	'ENDIF': TokenType.ENDIF,
	'CASE': TokenType.CASE,
	'ENDCASE': TokenType.ENDCASE,
	'OTHERWISE': TokenType.OTHERWISE,
	'FOR': TokenType.FOR,
	'TO': TokenType.TO,
	'NEXT': TokenType.NEXT,
	'STEP': TokenType.STEP,
	'WHILE': TokenType.WHILE,
	'ENDWHILE': TokenType.ENDWHILE,
	'REPEAT': TokenType.REPEAT,
	'UNTIL': TokenType.UNTIL,
	'PROCEDURE': TokenType.PROCEDURE,
	'ENDPROCEDURE': TokenType.ENDPROCEDURE,
	'FUNCTION': TokenType.FUNCTION,
	'ENDFUNCTION': TokenType.ENDFUNCTION,
	'DECLARE': TokenType.DECLARE,
	'CONSTANT': TokenType.CONSTANT,
	'ARRAY': TokenType.ARRAY,
	'OF': TokenType.OF,
	'TYPE': TokenType.TYPE,
	'ENDTYPE': TokenType.ENDTYPE,
	'CLASS': TokenType.CLASS,
	'ENDCLASS': TokenType.ENDCLASS,
	'INHERITS': TokenType.INHERITS,
	'PUBLIC': TokenType.PUBLIC,
	'PRIVATE': TokenType.PRIVATE,
	'NEW': TokenType.NEW,
	'BYVAL': TokenType.BYVAL,
	'BYREF': TokenType.BYREF,
	'RETURNS': TokenType.RETURNS,
	'CALL': TokenType.CALL,
	'INPUT': TokenType.INPUT,
	'OUTPUT': TokenType.OUTPUT,
	'OPENFILE': TokenType.OPENFILE,
	'CLOSEFILE': TokenType.CLOSEFILE,
	'READFILE': TokenType.READFILE,
	'WRITEFILE': TokenType.WRITEFILE,
	'SEEK': TokenType.SEEK,
	'GETRECORD': TokenType.GETRECORD,
	'PUTRECORD': TokenType.PUTRECORD,
	'EOF': TokenType.EOF,
	'FROM': TokenType.FROM,
	'INTEGER': TokenType.INTEGER,
	'REAL': TokenType.REAL,
	'CHAR': TokenType.CHAR,
	'STRING': TokenType.STRING,
	'BOOLEAN': TokenType.BOOLEAN,
	'DATE': TokenType.DATE,
	'TRUE': TokenType.TRUE,
	'FALSE': TokenType.FALSE,
	'AND': TokenType.AND,
	'OR': TokenType.OR,
	'NOT': TokenType.NOT
};

/**
 * Mapping of operator symbols to token types
 */
export const OPERATOR_TOKENS: Record<string, TokenType> = {
	'<-': TokenType.ASSIGNMENT,
	'+': TokenType.PLUS,
	'-': TokenType.MINUS,
	'*': TokenType.MULTIPLY,
	'/': TokenType.DIVIDE,
	'DIV': TokenType.DIV,
	'MOD': TokenType.MOD,
	'=': TokenType.EQUAL,
	'<>': TokenType.NOT_EQUAL,
	'<': TokenType.LESS_THAN,
	'>': TokenType.GREATER_THAN,
	'<=': TokenType.LESS_EQUAL,
	'>=': TokenType.GREATER_EQUAL,
	'AND': TokenType.AND,
	'OR': TokenType.OR,
	'NOT': TokenType.NOT,
};

/**
 * Mapping of delimiter symbols to token types
 */
export const DELIMITER_TOKENS: Record<string, TokenType> = {
	'(': TokenType.LEFT_PAREN,
	')': TokenType.RIGHT_PAREN,
	'[': TokenType.LEFT_BRACKET,
	']': TokenType.RIGHT_BRACKET,
	',': TokenType.COMMA,
	':': TokenType.COLON
};

/**
 * Token class representing a single token in the CAIE pseudocode language
 */
export class Token {
	constructor(
		public type: TokenType,
		public value: string,
		public line: number,
		public column: number
	) { }

	/**
	 * Check if this token is a keyword
	 */
	isKeyword(): boolean {
		return Object.values(KEYWORD_TOKENS).includes(this.type);
	}

	/**
	 * Check if this token is an operator
	 */
	isOperator(): boolean {
		return Object.values(OPERATOR_TOKENS).includes(this.type);
	}

	/**
	 * Check if this token is a delimiter
	 */
	isDelimiter(): boolean {
		return Object.values(DELIMITER_TOKENS).includes(this.type);
	}

	/**
	 * Check if this token is a literal
	 */
	isLiteral(): boolean {
		return [
			TokenType.INTEGER_LITERAL,
			TokenType.REAL_LITERAL,
			TokenType.STRING_LITERAL,
			TokenType.CHAR_LITERAL,
			TokenType.TRUE,
			TokenType.FALSE
		].includes(this.type);
	}

	/**
	 * Check if this token is a data type
	 */
	isDataType(): boolean {
		return [
			TokenType.INTEGER,
			TokenType.REAL,
			TokenType.CHAR,
			TokenType.STRING,
			TokenType.BOOLEAN,
			TokenType.DATE
		].includes(this.type);
	}

	/**
	 * Get a string representation of the token
	 */
	toString(): string {
		return `Token(${this.type}, "${this.value}", ${this.line}:${this.column})`;
	}

	/**
	 * Check if this token matches the given type and optionally value
	 */
	matches(type: TokenType, value?: string): boolean {
		if (this.type !== type) {
			return false;
		}

		if (value !== undefined && this.value !== value) {
			return false;
		}

		return true;
	}
}

/**
 * Token factory for creating tokens with consistent formatting
 */
export class TokenFactory {
	/**
	 * Create a token with the given type and value
	 */
	static create(
		type: TokenType,
		value: string,
		line: number,
		column: number
	): Token {
		return new Token(type, value, line, column);
	}

	/**
	 * Create an EOF token
	 */
	static createEOF(line: number, column: number): Token {
		return new Token(TokenType.EOF_TOKEN, '', line, column);
	}

	/**
	 * Create a newline token
	 */
	static createNewline(line: number, column: number): Token {
		return new Token(TokenType.NEWLINE, '\\n', line, column);
	}

	/**
	 * Create a comment token
	 */
	static createComment(value: string, line: number, column: number): Token {
		return new Token(TokenType.COMMENT, value, line, column);
	}

	/**
	 * Create an identifier token
	 */
	static createIdentifier(value: string, line: number, column: number): Token {
		return new Token(TokenType.IDENTIFIER, value, line, column);
	}

	/**
	 * Create an integer literal token
	 */
	static createIntegerLiteral(value: string, line: number, column: number): Token {
		return new Token(TokenType.INTEGER_LITERAL, value, line, column);
	}

	/**
	 * Create a real literal token
	 */
	static createRealLiteral(value: string, line: number, column: number): Token {
		return new Token(TokenType.REAL_LITERAL, value, line, column);
	}

	/**
	 * Create a string literal token
	 */
	static createStringLiteral(value: string, line: number, column: number): Token {
		return new Token(TokenType.STRING_LITERAL, value, line, column);
	}

	/**
	 * Create a char literal token
	 */
	static createCharLiteral(value: string, line: number, column: number): Token {
		return new Token(TokenType.CHAR_LITERAL, value, line, column);
	}
}
