/**
 * Lexer for CAIE Pseudocode Interpreter
 * 
 * This module implements the lexer for the CAIE pseudocode language.
 * It converts source code into a stream of tokens.
 */

import { Token, TokenType, TokenFactory } from './tokens';
import { SyntaxError } from '../errors';

/**
 * Lexer class for tokenizing CAIE pseudocode source code
 */
export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start: number = 0;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source code
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      // We're at the beginning of the next lexeme
      this.start = this.current;
      this.scanToken();
    }

    // Add EOF token
    this.tokens.push(TokenFactory.createEOF(this.line, this.column));
    return this.tokens;
  }

  /**
   * Scan a single token
   */
  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Single-character tokens
      case '(': this.addToken(TokenType.LEFT_PAREN); break;
      case ')': this.addToken(TokenType.RIGHT_PAREN); break;
      case '[': this.addToken(TokenType.LEFT_BRACKET); break;
      case ']': this.addToken(TokenType.RIGHT_BRACKET); break;
      case ',': this.addToken(TokenType.COMMA); break;
      case ':': this.addToken(TokenType.COLON); break;
      
      // One or two character tokens
      case '+': this.addToken(TokenType.PLUS); break;
      case '-': 
        if (this.match('>')) {
          this.addToken(TokenType.ASSIGNMENT);
        } else {
          this.addToken(TokenType.MINUS);
        }
        break;
      case '*': this.addToken(TokenType.MULTIPLY); break;
      case '/': this.addToken(TokenType.DIVIDE); break;
      case '=': this.addToken(TokenType.EQUAL); break;
      case '<':
        if (this.match('=')) {
          this.addToken(TokenType.LESS_EQUAL);
        } else if (this.match('>')) {
          this.addToken(TokenType.NOT_EQUAL);
        } else if (this.match("-")){
            this.addToken(TokenType.ASSIGNMENT);
        }
        else {
          this.addToken(TokenType.LESS_THAN);
        }
        break;
      case '>':
        if (this.match('=')) {
          this.addToken(TokenType.GREATER_EQUAL);
        } else {
          this.addToken(TokenType.GREATER_THAN);
        }
        break;
      
      // Whitespace
      case ' ':
      case '\r':
      case '\t':
        // Ignore whitespace
        break;
        
      case '\n':
        this.addToken(TokenType.NEWLINE);
        this.line++;
        this.column = 1;
        break;
        
      // Comments
      case '/':
        if (this.match('/')) {
          // A comment goes until the end of the line
          while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
        } else {
          this.addToken(TokenType.DIVIDE);
        }
        break;
        
      // String literals
      case '"':
        this.string();
        break;
        
      // Character literals
      case "'":
        this.character();
        break;
        
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new SyntaxError(`Unexpected character: ${c}`, this.line, this.column);
        }
        break;
    }
  }

  /**
   * Scan a string literal
   */
  private string(): void {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new SyntaxError('Unterminated string', this.line, this.column);
    }

    // The closing "
    this.advance();

    // Trim the surrounding quotes to get the value
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(TokenType.STRING_LITERAL, value);
  }

  /**
   * Scan a character literal
   */
  private character(): void {
    if (this.isAtEnd()) {
      throw new SyntaxError('Unterminated character literal', this.line, this.column);
    }

    // Get the character
    const value = this.advance();

    // Check for closing '
    if (this.peek() !== "'" && !this.isAtEnd()) {
      throw new SyntaxError('Unterminated character literal', this.line, this.column);
    }

    // The closing '
    this.advance();

    this.addToken(TokenType.CHAR_LITERAL, value);
  }

  /**
   * Scan a number literal
   */
  private number(): void {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    // Get the number value
    const value = this.source.substring(this.start, this.current);
    
    // Check if it's a real number
    if (value.includes('.')) {
      this.addToken(TokenType.REAL_LITERAL, parseFloat(value));
    } else {
      this.addToken(TokenType.INTEGER_LITERAL, parseInt(value, 10));
    }
  }

  /**
   * Scan an identifier or keyword
   */
  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) this.advance();

    const text = this.source.substring(this.start, this.current);
    
    // Check if it's a keyword
    const tokenType = KEYWORD_TOKENS[text.toUpperCase()];
    if (tokenType !== undefined) {
      this.addToken(tokenType);
    } else {
      // It's a regular identifier
      this.addToken(TokenType.IDENTIFIER, text);
    }
  }

  /**
   * Check if the current character matches the expected one
   */
  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  /**
   * Look at the current character without consuming it
   */
  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  /**
   * Look at the character after the current one
   */
  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private peekOffset(offset: number): string {
    if (this.current + offset >= this.source.length) return '\0';
    return this.source.charAt(this.current + offset);
  }

  /**
   * Check if a character is a digit
   */
  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  /**
   * Check if a character is an alphabetic character
   */
  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  /**
   * Check if a character is alphanumeric
   */
  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  /**
   * Check if we're at the end of the source
   */
  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  /**
   * Advance to the next character and return it
   */
  private advance(): string {
    this.current++;
    this.column++;
    return this.source.charAt(this.current - 1);
  }

  /**
   * Add a token to the tokens list
   */
  private addToken(type: TokenType, value?: any): void {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(TokenFactory.create(type, value || text, this.line, this.column - text.length));
  }
}

// Import the KEYWORD_TOKENS from tokens.ts
import { KEYWORD_TOKENS } from './tokens';