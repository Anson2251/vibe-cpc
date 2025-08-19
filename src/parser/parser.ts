/**
 * Parser for CAIE Pseudocode Interpreter
 * 
 * This module implements the parser for the CAIE pseudocode language.
 * It converts a stream of tokens into an abstract syntax tree (AST).
 */

import { Token, TokenType } from '../lexer/tokens';
import {
  ASTNode,
  ProgramNode,
  StatementNode,
  ExpressionNode,
  VariableDeclarationNode,
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
  ReturnNode,
  OpenFileNode,
  CloseFileNode,
  ReadFileNode,
  WriteFileNode,
  SeekNode,
  GetRecordNode,
  PutRecordNode,
  TypeDeclarationNode,
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
  TypeCastNode,
  ParameterNode,
  ArrayTypeNode,
  EOFNode
} from './ast-nodes';
import { 
  PseudocodeType, 
  ArrayTypeInfo, 
  UserDefinedTypeInfo, 
  ParameterMode 
} from '../types';
import { SyntaxError } from '../errors';

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
  parse(): ProgramNode {
    const statements: StatementNode[] = [];
    
    while (!this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        statements.push(stmt);
      }
    }
    
    return {
      type: 'Program',
      body: statements
    };
  }

  /**
   * Parse a statement
   */
  private statement(): StatementNode | null {
    try {
      // Skip newlines
      while (this.match(TokenType.NEWLINE)) { } // Keep consuming newlines
      
      if (this.isAtEnd()) {
        return null;
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
      
      if (this.match(TokenType.RETURNS)) {
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
      
      if (this.match(TokenType.CLASS)) {
        return this.classDeclaration();
      }
      
      // If none of the above, try to parse as an assignment or expression statement
      return this.assignmentOrExpressionStatement();
    } catch (error) {
      // Synchronize on statement boundaries
      this.synchronize();
      throw new SyntaxError((error as any).message ?? 'Unknown error', this.peek().line, this.peek().column);
    }
  }

  /**
   * Parse a DECLARE statement
   */
  private declareStatement(): DeclareStatementNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    // Get variable name
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected variable name");
    const name = nameToken.value;

    this.consume(TokenType.COLON, "Expected ':' after variable name, before data type");
    
    // Get data type
    let dataType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo;
    
    if (this.match(TokenType.ARRAY)) {
      // Array type
      this.consume(TokenType.OF, "Expected 'OF' after ARRAY");
      const elementType = this.parseDataType();
      
      // Parse array dimensions
      const dimensions: number[] = [];
      this.consume(TokenType.LEFT_BRACKET, "Expected '[' for array dimensions");
      
      while (!this.check(TokenType.RIGHT_BRACKET)) {
        const expr = this.expression();
        if (expr.type !== 'Literal' || typeof (expr as LiteralNode).value !== 'number') {
          throw this.error(this.peek(), "Array dimensions must be integer literals");
        }
        dimensions.push((expr as LiteralNode).value);
        
        if (!this.match(TokenType.COMMA)) {
          break;
        }
      }
      
      this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array dimensions");
      
      dataType = {
        elementType,
        dimensions
      } as ArrayTypeInfo;
    } else {
      // console.log(this.advance(), this.peek())
      dataType = this.parseDataType();
    }
    
    if (this.match(TokenType.ASSIGNMENT)) {
      throw new Error("Assignment not allowed in DECLARE statement");
    }
    
    // Consume newline at the end of statement
    this.consumeNewline();
    
    return {
      type: 'DeclareStatement',
      name,
      dataType,
      isConstant: false,
      initialValue: undefined,
      line,
      column
    };
  }

  /**
   * Parse an IF statement
   */
  private ifStatement(): IfNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const condition = this.expression();
    this.consume(TokenType.THEN, "Expected 'THEN' after IF condition, found " + this.peek().value);
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
      type: 'If',
      condition,
      thenBranch,
      elseBranch,
      line,
      column
    };
  }

  /**
   * Parse a CASE statement
   */
  private caseStatement(): CaseNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const expression = this.expression();
    this.consume(TokenType.OF, "Expected 'OF' after CASE expression");
    this.consumeNewline();
    
    const cases: { values: ExpressionNode[], body: StatementNode[] }[] = [];
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
      
      // Parse case values (can be multiple separated by commas)
      // Check if there's at least one expression before the colon
      if (this.check(TokenType.COLON)) {
        throw this.error(this.peek(), "Expected at least one CASE value before ':'");
      }
      
      do {
        caseValues.push(this.expression());
      } while (this.match(TokenType.COMMA));
      
      this.consume(TokenType.COLON, "Expected ':' after CASE values");
      this.consumeNewline();
      
      // Parse case body
      const caseBody: StatementNode[] = [];
      while (
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
        body: caseBody
      });
    }
    
    this.consume(TokenType.ENDCASE, "Expected 'ENDCASE' to close CASE statement");
    this.consumeNewline();
    
    return {
      type: 'Case',
      expression,
      cases,
      otherwise,
      line,
      column
    };
  }

  /**
   * Parse a FOR statement
   */
  private forStatement(): ForNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const variableToken = this.consume(TokenType.IDENTIFIER, "Expected variable name in FOR loop");
    const variable = variableToken.value;
    
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
      type: 'For',
      variable,
      start,
      end,
      step,
      body,
      line,
      column
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
      type: 'While',
      condition,
      body,
      line,
      column
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
      type: 'Repeat',
      body,
      condition,
      line,
      column
    };
  }

  /**
   * Parse a procedure declaration
   */
  private procedureDeclaration(): ProcedureDeclarationNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected procedure name");
    const name = nameToken.value;
    
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
    
    this.consume(TokenType.ENDPROCEDURE, "Expected 'ENDPROCEDURE' to close procedure declaration");
    this.consumeNewline();
    
    return {
      type: 'ProcedureDeclaration',
      name,
      parameters,
      body,
      line,
      column
    };
  }

  /**
   * Parse a function declaration
   */
  private functionDeclaration(): FunctionDeclarationNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected function name");
    const name = nameToken.value;
    
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name");
    const parameters = this.parseParameters();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");
    
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
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      line,
      column
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
        const name = nameToken.value;
        
        this.consume(TokenType.COLON, "Expected ':' after parameter name");
        const dataType = this.parseDataType();
        
        parameters.push({
          type: 'Parameter',
          name,
          dataType,
          mode,
          line,
          column
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
    const name = nameToken.value;
    
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after procedure name");
    const args: ExpressionNode[] = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments");
    this.consumeNewline();
    
    return {
      type: 'CallStatement',
      name,
      arguments: args,
      line,
      column
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
    if (target.type !== 'Identifier' && target.type !== 'ArrayAccess') {
      throw this.error(this.peek(), "Expected variable name for INPUT statement");
    }
    this.consumeNewline();
    
    return {
      type: 'Input',
      prompt,
      target: target as (IdentifierNode | ArrayAccessNode),
      line,
      column
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
      type: 'Output',
      expressions,
      line,
      column
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
      type: 'Return',
      value,
      line,
      column
    };
  }

  /**
   * Parse an OPENFILE statement
   */
  private openFileStatement(): OpenFileNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const filename = this.expression();
    
    let mode: 'READ' | 'WRITE' | 'APPEND' | 'RANDOM' = 'READ';
    if (this.match(TokenType.IDENTIFIER)) {
      const modeToken = this.previous();
      const modeValue = modeToken.value.toUpperCase();
      if (modeValue === 'READ' || modeValue === 'WRITE' || modeValue === 'APPEND' || modeValue === 'RANDOM') {
        mode = modeValue;
      } else {
        throw this.error(modeToken, "Invalid file mode. Expected READ, WRITE, APPEND, or RANDOM");
      }
    }
    
    this.consume(TokenType.FOR, "Expected 'FOR' after filename");
    const fileHandle = this.primary();
    this.consumeNewline();
    
    return {
      type: 'OpenFile',
      filename,
      mode,
      fileHandle,
      line,
      column
    };
  }

  /**
   * Parse a CLOSEFILE statement
   */
  private closeFileStatement(): CloseFileNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consumeNewline();
    
    return {
      type: 'CloseFile',
      fileHandle,
      line,
      column
    };
  }

  /**
   * Parse a READFILE statement
   */
  private readFileStatement(): ReadFileNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consume(TokenType.FROM, "Expected 'FROM' after file handle");
    const target = this.primary();
    this.consumeNewline();
    
    return {
      type: 'ReadFile',
      fileHandle,
      target,
      line,
      column
    };
  }

  /**
   * Parse a WRITEFILE statement
   */
  private writeFileStatement(): WriteFileNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consume(TokenType.TO, "Expected 'TO' after file handle");
    
    const expressions: ExpressionNode[] = [];
    if (!this.check(TokenType.NEWLINE)) {
      do {
        expressions.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    this.consumeNewline();
    
    return {
      type: 'WriteFile',
      fileHandle,
      expressions,
      line,
      column
    };
  }

  /**
   * Parse a SEEK statement
   */
  private seekStatement(): SeekNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consume(TokenType.TO, "Expected 'TO' after file handle");
    const position = this.expression();
    this.consumeNewline();
    
    return {
      type: 'Seek',
      fileHandle,
      position,
      line,
      column
    };
  }

  /**
   * Parse a GETRECORD statement
   */
  private getRecordStatement(): GetRecordNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consume(TokenType.FROM, "Expected 'FROM' after file handle");
    const position = this.expression();
    this.consume(TokenType.TO, "Expected 'TO' after position");
    const target = this.primary();
    this.consumeNewline();
    
    return {
      type: 'GetRecord',
      fileHandle,
      position,
      target,
      line,
      column
    };
  }

  /**
   * Parse a PUTRECORD statement
   */
  private putRecordStatement(): PutRecordNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const fileHandle = this.primary();
    this.consume(TokenType.TO, "Expected 'TO' after file handle");
    const position = this.expression();
    this.consume(TokenType.FROM, "Expected 'FROM' after position");
    const source = this.primary();
    this.consumeNewline();
    
    return {
      type: 'PutRecord',
      fileHandle,
      position,
      source,
      line,
      column
    };
  }

  /**
   * Parse a TYPE declaration
   */
  private typeDeclaration(): TypeDeclarationNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected type name");
    const name = nameToken.value;
    this.consumeNewline();
    
    const fields: FieldDeclarationNode[] = [];
    while (!this.check(TokenType.ENDTYPE) && !this.isAtEnd()) {
      const fieldLine = this.peek().line;
      const fieldColumn = this.peek().column;
      
      const fieldNameToken = this.consume(TokenType.IDENTIFIER, "Expected field name");
      const fieldName = fieldNameToken.value;
      
      this.consume(TokenType.COLON, "Expected ':' after field name");
      const dataType = this.parseDataType();
      this.consumeNewline();
      
      fields.push({
        type: 'FieldDeclaration',
        name: fieldName,
        dataType: dataType as PseudocodeType | ArrayTypeInfo,
        line: fieldLine,
        column: fieldColumn
      });
    }
    
    this.consume(TokenType.ENDTYPE, "Expected 'ENDTYPE' to close type declaration");
    this.consumeNewline();
    
    return {
      type: 'TypeDeclaration',
      name,
      fields,
      line,
      column
    };
  }

  /**
   * Parse a CLASS declaration
   */
  private classDeclaration(): ClassDeclarationNode {
    const line = this.previous().line;
    const column = this.previous().column;
    
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected class name");
    const name = nameToken.value;
    
    let inherits: string | undefined;
    if (this.match(TokenType.INHERITS)) {
      const parentToken = this.consume(TokenType.IDENTIFIER, "Expected parent class name");
      inherits = parentToken.value;
    }
    
    this.consumeNewline();
    
    const fields: FieldDeclarationNode[] = [];
    const methods: MethodDeclarationNode[] = [];
    
    while (!this.check(TokenType.ENDCLASS) && !this.isAtEnd()) {
      if (this.match(TokenType.PUBLIC) || this.match(TokenType.PRIVATE)) {
        const visibility = this.previous().value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
        
        if (this.check(TokenType.IDENTIFIER) && this.peek().value !== 'DECLARE') {
          // Method declaration
          const method = this.methodDeclaration(visibility);
          methods.push(method);
        } else {
          // Field declaration
          this.consume(TokenType.DECLARE, "Expected 'DECLARE' for field declaration");
          const fieldNameToken = this.consume(TokenType.IDENTIFIER, "Expected field name");
          const fieldName = fieldNameToken.value;
          
          this.consume(TokenType.COLON, "Expected ':' after field name");
          const dataType = this.parseDataType();
          this.consumeNewline();
          
          fields.push({
            type: 'FieldDeclaration',
            name: fieldName,
            dataType: dataType as PseudocodeType | ArrayTypeInfo,
            line: fieldNameToken.line,
            column: fieldNameToken.column
          });
        }
      } else {
        // Default visibility is PRIVATE
        if (this.check(TokenType.IDENTIFIER) && this.peek().value !== 'DECLARE') {
          // Method declaration
          const method = this.methodDeclaration('PRIVATE');
          methods.push(method);
        } else {
          // Field declaration
          this.consume(TokenType.DECLARE, "Expected 'DECLARE' for field declaration");
          const fieldNameToken = this.consume(TokenType.IDENTIFIER, "Expected field name");
          const fieldName = fieldNameToken.value;
          
          this.consume(TokenType.COLON, "Expected ':' after field name");
          const dataType = this.parseDataType();
          this.consumeNewline();
          
          fields.push({
            type: 'FieldDeclaration',
            name: fieldName,
            dataType: dataType as PseudocodeType | ArrayTypeInfo,
            line: fieldNameToken.line,
            column: fieldNameToken.column
          });
        }
      }
    }
    
    this.consume(TokenType.ENDCLASS, "Expected 'ENDCLASS' to close class declaration");
    this.consumeNewline();
    
    return {
      type: 'ClassDeclaration',
      name,
      inherits,
      fields,
      methods,
      line,
      column
    };
  }

  /**
   * Parse a method declaration within a class
   */
  private methodDeclaration(visibility: 'PUBLIC' | 'PRIVATE'): MethodDeclarationNode {
    const line = this.peek().line;
    const column = this.peek().column;
    
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected method name");
    const name = nameToken.value;
    
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after method name");
    const parameters = this.parseParameters();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");
    
    let returnType: PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo | undefined;
    if (this.match(TokenType.RETURNS)) {
      returnType = this.parseDataType();
    }
    
    this.consumeNewline();
    
    const body: StatementNode[] = [];
    while (!this.check(TokenType.ENDCLASS) && !this.check(TokenType.PUBLIC) && !this.check(TokenType.PRIVATE) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        body.push(stmt);
      }
    }
    
    return {
      type: 'MethodDeclaration',
      name,
      visibility,
      parameters,
      returnType,
      body,
      line,
      column
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
      
      return {
        type: 'Assignment',
        target: expr,
        value,
        line: expr.line,
        column: expr.column
      } as AssignmentNode;
    }
    
    // Expression statement (e.g., function call)
    this.consumeNewline();
    
    // If it's a call expression, convert it to a call statement
    if (expr.type === 'CallExpression') {
      const callExpr = expr as CallExpressionNode;
      return {
        type: 'CallStatement',
        name: callExpr.name,
        arguments: callExpr.arguments,
        line: expr.line,
        column: expr.column
      } as CallStatementNode;
    }
    
    // Otherwise, it's just an expression statement
    return expr as StatementNode;
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
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
    }
    
    return expr;
  }

  /**
   * Parse a logical AND expression
   */
  private logicalAnd(): ExpressionNode {
    let expr = this.equality();
    
    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
    }
    
    return expr;
  }

  /**
   * Parse an equality expression
   */
  private equality(): ExpressionNode {
    let expr = this.comparison();
    
    while (this.match(TokenType.EQUAL) || this.match(TokenType.NOT_EQUAL)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
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
      this.match(TokenType.LESS_EQUAL)
    ) {
      const operator = this.previous().value;
      const right = this.term();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
    }
    
    return expr;
  }

  /**
   * Parse a term expression
   */
  private term(): ExpressionNode {
    let expr = this.factor();
    
    while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.factor();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
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
      const operator = this.previous().value;
      const right = this.unary();
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        line: expr.line,
        column: expr.column
      } as BinaryExpressionNode;
    }
    
    return expr;
  }

  /**
   * Parse a unary expression
   */
  private unary(): ExpressionNode {
    if (this.match(TokenType.MINUS) || this.match(TokenType.NOT)) {
      const operator = this.previous().value;
      const right = this.unary();
      return {
        type: 'UnaryExpression',
        operator,
        operand: right,
        line: this.previous().line,
        column: this.previous().column
      } as UnaryExpressionNode;
    }
    
    return this.primary();
  }

  /**
   * Parse a primary expression
   */
  private primary(): ExpressionNode {
    if (this.match(TokenType.TRUE)) {
      return {
        type: 'Literal',
        value: true,
        dataType: PseudocodeType.BOOLEAN,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.FALSE)) {
      return {
        type: 'Literal',
        value: false,
        dataType: PseudocodeType.BOOLEAN,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.INTEGER_LITERAL)) {
      return {
        type: 'Literal',
        value: parseInt(this.previous().value, 10),
        dataType: PseudocodeType.INTEGER,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.REAL_LITERAL)) {
      return {
        type: 'Literal',
        value: parseFloat(this.previous().value),
        dataType: PseudocodeType.REAL,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.STRING_LITERAL)) {
      return {
        type: 'Literal',
        value: this.previous().value,
        dataType: PseudocodeType.STRING,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.CHAR_LITERAL)) {
      return {
        type: 'Literal',
        value: this.previous().value,
        dataType: PseudocodeType.CHAR,
        line: this.previous().line,
        column: this.previous().column
      } as LiteralNode;
    }
    
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous().value;
      
      // Check if it's a function call
      if (this.match(TokenType.LEFT_PAREN)) {
        const args: ExpressionNode[] = [];
        
        if (!this.check(TokenType.RIGHT_PAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments");
        
        return {
          type: 'CallExpression',
          name,
          arguments: args,
          line: this.previous().line,
          column: this.previous().column
        } as CallExpressionNode;
      }
      
      // Check if it's an array access
      if (this.match(TokenType.LEFT_BRACKET)) {
        const indices: ExpressionNode[] = [];
        
        do {
          indices.push(this.expression());
        } while (this.match(TokenType.COMMA));
        
        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array indices");
        
        // Get the identifier token to extract correct line and column info
        // The identifier token is at current - indices.length - 2
        const identifierIndex = this.current - indices.length - 2;
        const identifierToken = this.tokens[identifierIndex];
        const rightBracketToken = this.previous();
        
        return {
          type: 'ArrayAccess',
          array: {
            type: 'Identifier',
            name,
            line: identifierToken.line,
            column: identifierToken.column
          } as IdentifierNode,
          indices,
          line: rightBracketToken.line,
          column: rightBracketToken.column
        } as ArrayAccessNode;
      }
      
      // Otherwise, it's a simple identifier
      return {
        type: 'Identifier',
        name,
        line: this.previous().line,
        column: this.previous().column
      } as IdentifierNode;
    }
    
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression");
      return expr;
    }
    
    if (this.match(TokenType.NEW)) {
      const classNameToken = this.consume(TokenType.IDENTIFIER, "Expected class name after NEW");
      const className = classNameToken.value;
      
      this.consume(TokenType.LEFT_PAREN, "Expected '(' after class name");
      const args: ExpressionNode[] = [];
      
      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          args.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments");
      
      return {
        type: 'NewExpression',
        className,
        arguments: args,
        line: this.previous().line,
        column: this.previous().column
      } as NewExpressionNode;
    }
    
    throw this.error(this.peek(), "Expected expression");
  }

  /**
   * Parse a data type
   */
  private parseDataType(): PseudocodeType | ArrayTypeInfo | UserDefinedTypeInfo {
    const token = this.consumeLike([TokenType.STRING, TokenType.CHAR, TokenType.INTEGER, TokenType.REAL, TokenType.BOOLEAN, TokenType.DATE], `Expected data type, found "${this.peek().value}"`);
    const typeName = token.value.toUpperCase();
    
    // Check for built-in types
    switch (typeName) {
      case 'INTEGER':
        return PseudocodeType.INTEGER;
      case 'REAL':
        return PseudocodeType.REAL;
      case 'CHAR':
        return PseudocodeType.CHAR;
      case 'STRING':
        return PseudocodeType.STRING;
      case 'BOOLEAN':
        return PseudocodeType.BOOLEAN;
      case 'DATE':
        return PseudocodeType.DATE;
      default:
        // User-defined type
        return {
          name: typeName,
          fields: {} // This will be filled in during semantic analysis
        } as UserDefinedTypeInfo;
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
    
    throw this.error(this.peek(), message);
  }

  private consumeLike(types: TokenType[], message: string): Token {
    if (types.includes(this.peek().type)) return this.advance();

    throw this.error(this.peek(), message);
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
      
      switch (this.peek().type) {
        case TokenType.DECLARE:
        case TokenType.IF:
        case TokenType.FOR:
        case TokenType.WHILE:
        case TokenType.REPEAT:
        case TokenType.PROCEDURE:
        case TokenType.FUNCTION:
        case TokenType.INPUT:
        case TokenType.OUTPUT:
        case TokenType.OPENFILE:
        case TokenType.CLOSEFILE:
        case TokenType.RETURNS:
        case TokenType.CALL:
          return;
      }
      
      this.advance();
    }
  }
}
