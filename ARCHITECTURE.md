# CAIE Pseudocode Interpreter - Architecture Design

## Overview

This document outlines the architecture for a TypeScript interpreter for the CAIE pseudocode language. The interpreter will be designed to be ES2020 compatible, environment-agnostic, and modular.

## Project Structure

```
caie-pseudocode-interpreter/
├── src/
│   ├── core/           # Core interfaces and types
│   ├── lexer/          # Tokenization and lexical analysis
│   ├── parser/         # AST generation and parsing
│   ├── runtime/        # Execution engine
│   ├── types/          # Type system and mappings
│   ├── io/             # IO interface abstractions
│   ├── errors/         # Error handling
│   └── utils/          # Utility functions
├── tests/              # Test suite
├── examples/           # Example pseudocode programs
└── docs/               # Documentation
```

## Core Architecture Components

### 1. IO Interface Design

The IO interface will be ES2020 compatible and abstract enough to work in different environments (browser, Node.js, etc.).

```typescript
// src/io/interface.ts
interface IOInterface {
  // Console operations
  input(prompt?: string): Promise<string>;
  output(data: string): void;
  
  // File operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  appendFile(path: string, data: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  
  // Random file operations
  openRandomFile(path: string): Promise<number>;
  readRecord(fileHandle: number, position: number): Promise<string>;
  writeRecord(fileHandle: number, position: number, data: string): Promise<void>;
  closeFile(fileHandle: number): Promise<void>;
  
  // Error handling
  error(message: string, line?: number, column?: number): void;
}
```

### 2. Lexer (Tokenization)

The lexer will convert pseudocode source text into tokens.

```typescript
// src/lexer/lexer.ts
class Lexer {
  constructor(source: string, io: IOInterface) {}
  
  tokenize(): Token[] {
    // Convert source to tokens
  }
  
  private nextToken(): Token {
    // Get next token from source
  }
}

// src/lexer/tokens.ts
interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

enum TokenType {
  // Keywords
  IF, THEN, ELSE, ENDIF,
  FOR, TO, NEXT, STEP,
  WHILE, ENDWHILE,
  REPEAT, UNTIL,
  PROCEDURE, ENDPROCEDURE,
  FUNCTION, ENDFUNCTION,
  DECLARE, CONSTANT,
  ARRAY, OF,
  TYPE, ENDTYPE,
  CLASS, ENDCLASS,
  INHERITS,
  PUBLIC, PRIVATE,
  NEW,
  BYVAL, BYREF,
  RETURNS,
  CALL,
  INPUT, OUTPUT,
  OPENFILE, CLOSEFILE,
  READFILE, WRITEFILE,
  SEEK, GETRECORD, PUTRECORD,
  EOF,
  
  // Data types
  INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE,
  
  // Literals
  INTEGER_LITERAL, REAL_LITERAL, STRING_LITERAL, CHAR_LITERAL,
  TRUE, FALSE,
  
  // Identifiers
  IDENTIFIER,
  
  // Operators
  PLUS, MINUS, MULTIPLY, DIVIDE, DIV, MOD,
  EQUAL, NOT_EQUAL, LESS_THAN, GREATER_THAN,
  LESS_EQUAL, GREATER_EQUAL,
  AND, OR, NOT,
  ASSIGNMENT,
  
  // Delimiters
  LEFT_PAREN, RIGHT_PAREN,
  LEFT_BRACKET, RIGHT_BRACKET,
  COMMA, COLON,
  
  // Special
  COMMENT, NEWLINE, EOF_TOKEN
}
```

### 3. Parser (AST Generation)

The parser will convert tokens into an Abstract Syntax Tree (AST).

```typescript
// src/parser/parser.ts
class Parser {
  constructor(tokens: Token[], io: IOInterface) {}
  
  parse(): ProgramNode {
    // Generate AST from tokens
  }
}

// src/parser/ast.ts
interface ProgramNode {
  type: 'Program';
  body: StatementNode[];
}

interface StatementNode {
  // Various statement types
}

interface ExpressionNode {
  // Various expression types
}

// Statement types
interface VariableDeclarationNode extends StatementNode {
  type: 'VariableDeclaration';
  name: string;
  dataType: string;
  isArray?: boolean;
  arrayBounds?: [number, number][];
}

interface AssignmentNode extends StatementNode {
  type: 'Assignment';
  target: ExpressionNode;
  value: ExpressionNode;
}

interface IfNode extends StatementNode {
  type: 'If';
  condition: ExpressionNode;
  thenBranch: StatementNode[];
  elseBranch?: StatementNode[];
}

interface ForNode extends StatementNode {
  type: 'For';
  variable: string;
  start: ExpressionNode;
  end: ExpressionNode;
  step?: ExpressionNode;
  body: StatementNode[];
}

interface WhileNode extends StatementNode {
  type: 'While';
  condition: ExpressionNode;
  body: StatementNode[];
}

interface RepeatNode extends StatementNode {
  type: 'Repeat';
  body: StatementNode[];
  condition: ExpressionNode;
}

interface ProcedureDeclarationNode extends StatementNode {
  type: 'ProcedureDeclaration';
  name: string;
  parameters: ParameterNode[];
  body: StatementNode[];
}

interface FunctionDeclarationNode extends StatementNode {
  type: 'FunctionDeclaration';
  name: string;
  parameters: ParameterNode[];
  returnType: string;
  body: StatementNode[];
}

// Expression types
interface BinaryExpressionNode extends ExpressionNode {
  type: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

interface IdentifierNode extends ExpressionNode {
  type: 'Identifier';
  name: string;
}

interface LiteralNode extends ExpressionNode {
  type: 'Literal';
  value: any;
  dataType: string;
}

interface CallExpressionNode extends ExpressionNode {
  type: 'CallExpression';
  callee: string;
  arguments: ExpressionNode[];
}
```

### 4. Runtime (Execution Engine)

The runtime will execute the AST and manage program state.

```typescript
// src/runtime/runtime.ts
class Runtime {
  constructor(io: IOInterface) {
    this.io = io;
    this.memory = new MemoryManager();
    this.callStack = new CallStack();
  }
  
  async execute(program: ProgramNode): Promise<void> {
    // Execute the program
  }
  
  private async executeStatement(statement: StatementNode): Promise<void> {
    // Execute individual statements
  }
  
  private async evaluateExpression(expression: ExpressionNode): Promise<any> {
    // Evaluate expressions
  }
}
```

### 5. Memory Management (Variables, Scope)

The memory manager will handle variables, scope, and data storage.

```typescript
// src/runtime/memory.ts
class MemoryManager {
  private globalScope: Scope;
  private currentScope: Scope;
  
  constructor() {
    this.globalScope = new Scope('global');
    this.currentScope = this.globalScope;
  }
  
  enterScope(name: string): void {
    const newScope = new Scope(name, this.currentScope);
    this.currentScope = newScope;
  }
  
  exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }
  
  declareVariable(name: string, type: string, value?: any): void {
    this.currentScope.declareVariable(name, type, value);
  }
  
  getVariable(name: string): any {
    return this.currentScope.getVariable(name);
  }
  
  setVariable(name: string, value: any): void {
    this.currentScope.setVariable(name, value);
  }
}

class Scope {
  constructor(
    public name: string,
    public parent: Scope | null = null
  ) {
    this.variables = new Map<string, Variable>();
  }
  
  private variables: Map<string, Variable>;
  
  declareVariable(name: string, type: string, value?: any): void {
    this.variables.set(name, new Variable(name, type, value));
  }
  
  getVariable(name: string): any {
    if (this.variables.has(name)) {
      return this.variables.get(name)!.value;
    }
    
    if (this.parent) {
      return this.parent.getVariable(name);
    }
    
    throw new Error(`Variable '${name}' not found`);
  }
  
  setVariable(name: string, value: any): void {
    if (this.variables.has(name)) {
      this.variables.get(name)!.value = value;
      return;
    }
    
    if (this.parent) {
      this.parent.setVariable(name, value);
      return;
    }
    
    throw new Error(`Variable '${name}' not found`);
  }
}

class Variable {
  constructor(
    public name: string,
    public type: string,
    public value: any
  ) {}
}
```

### 6. Error Handling Strategy

The error handling system will provide comprehensive error reporting.

```typescript
// src/errors/error-handler.ts
class ErrorHandler {
  constructor(private io: IOInterface) {}
  
  syntaxError(message: string, line: number, column: number): void {
    this.io.error(`Syntax Error: ${message} at line ${line}, column ${column}`);
  }
  
  runtimeError(message: string, line?: number, column?: number): void {
    const location = line && column ? ` at line ${line}, column ${column}` : '';
    this.io.error(`Runtime Error: ${message}${location}`);
  }
  
  typeError(message: string, line?: number, column?: number): void {
    const location = line && column ? ` at line ${line}, column ${column}` : '';
    this.io.error(`Type Error: ${message}${location}`);
  }
}

// src/errors/errors.ts
class PseudocodeError extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number
  ) {
    super(message);
  }
}

class SyntaxError extends PseudocodeError {}
class RuntimeError extends PseudocodeError {}
class TypeError extends PseudocodeError {}
```

### 7. Type System

The type system will handle CAIE pseudocode types and their TypeScript mappings.

```typescript
// src/types/type-system.ts
class TypeSystem {
  // CAIE pseudocode types to TypeScript mappings
  static typeMappings: Record<string, string> = {
    'INTEGER': 'number',
    'REAL': 'number',
    'CHAR': 'string',
    'STRING': 'string',
    'BOOLEAN': 'boolean',
    'DATE': 'Date'
  };
  
  static mapPseudocodeToType(pseudocodeType: string): string {
    return this.typeMappings[pseudocodeType] || 'any';
  }
  
  static isCompatible(expectedType: string, actualType: string): boolean {
    if (expectedType === actualType) return true;
    
    // Allow INTEGER to REAL conversion
    if (expectedType === 'REAL' && actualType === 'INTEGER') return true;
    
    return false;
  }
  
  static validateValue(value: any, expectedType: string): boolean {
    const tsType = typeof value;
    
    switch (expectedType) {
      case 'INTEGER':
        return tsType === 'number' && Number.isInteger(value);
      case 'REAL':
        return tsType === 'number';
      case 'CHAR':
        return tsType === 'string' && value.length === 1;
      case 'STRING':
        return tsType === 'string';
      case 'BOOLEAN':
        return tsType === 'boolean';
      case 'DATE':
        return value instanceof Date;
      default:
        return true;
    }
  }
}
```

## Implementation Plan

1. **IO Interface Implementation**
   - Create base IO interface
   - Implement Node.js compatibility layer
   - Implement browser compatibility layer

2. **Lexer Implementation**
   - Token definitions
   - Lexical analysis logic
   - Error handling for invalid tokens

3. **Parser Implementation**
   - AST node definitions
   - Parsing logic for all statement types
   - Error handling for syntax errors

4. **Runtime Implementation**
   - Memory management
   - Statement execution
   - Expression evaluation
   - Procedure and function handling

5. **Type System Implementation**
   - Type validation
   - Type conversion
   - Array and user-defined type handling

6. **Error Handling Implementation**
   - Comprehensive error reporting
   - Error recovery strategies
   - User-friendly error messages

## Environment Compatibility

The interpreter will be designed to work in multiple environments:

- **Node.js**: Using file system APIs and console I/O
- **Browser**: Using browser APIs and DOM manipulation for I/O
- **Deno**: Using Deno's standard library
- **Other ES2020 environments**: Through custom IO implementations

## Testing Strategy

- Unit tests for each component
- Integration tests for the full interpreter
- End-to-end tests with example pseudocode programs
- Performance tests for large programs

## Future Enhancements

- Debugging capabilities
- Source maps for better error reporting
- Optimization passes
- IDE integration
- Visual execution flow