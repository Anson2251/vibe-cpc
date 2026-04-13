# CAIE Pseudocode Interpreter

A TypeScript interpreter for the CAIE (Cambridge Assessment International Education) pseudocode language, designed to be ES2020 compatible and environment-agnostic.

## Overview

This interpreter provides a complete implementation of the CAIE pseudocode specification, enabling students and educators to execute and test pseudocode programs in various environments including Node.js, browsers, and other ES2020-compatible platforms.

## Key Features (Expected)

- **Complete CAIE Specification Support**: Implements all language features from the CAIE pseudocode guide
- **ES2020 Compatible**: No Node.js dependencies, works in any ES2020 environment
- **Environment Agnostic**: Runs in Node.js, browsers, and other JavaScript environments
- **Modular Architecture**: Clean separation of concerns with pluggable components
- **Comprehensive Error Handling**: Detailed error messages with line and column information
- **Type System**: Robust type checking and conversion between pseudocode and TypeScript types
- **Portable binary executable**: Compiled to a portable binary for easy distribution and deployment via QuickJS
- **Built-in Debugger Extension (non-CAIE)**: Supports `DEBUGGER` statement, stepping, and source breakpoints

## Architecture

The interpreter follows a modular architecture with clear separation of concerns:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Lexer       │───▶│     Parser      │───▶│    Runtime      │
│  (Tokenization) │    │  (AST Building) │    │ (Execution)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │  Memory Manager │
                                               │  (Variables)    │
                                               └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │   IO Interface  │
                                               │ (Console/Files) │
                                               └─────────────────┘
```

## Project Structure

```text
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

## IO Interface

The interpreter uses an abstract IO interface that can be implemented for different environments:

```typescript
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

## Supported Language Features

### Data Types
- **Primitive Types**: INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE
- **Composite Types**: Arrays (1D and 2D), Records, Sets
- **User-defined Types**: Enumerated types, Pointers

## Syntax Support Matrix

| Area | Syntax / Feature | Status | Notes |
| --- | --- | --- | --- |
| Variables and types | `DECLARE`, primitive types | ✅ Supported | INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE |
| Arrays | `ARRAY[lower:upper] OF <type>` | ✅ Supported | Multi-dimensional arrays supported |
| User-defined records | `TYPE Name ... ENDTYPE` | ✅ Supported | Nested record fields supported |
| Enumerations | `TYPE Season = (Spring, Summer, ...)` | ✅ Supported | Enum literals assignable by member name |
| Sets | `TYPE LetterSet = SET OF CHAR` + `DEFINE ... : LetterSet` | ✅ Supported | `IN` membership supported |
| Selection | `IF`, `CASE` | ✅ Supported | Includes `OTHERWISE` in CASE |
| Loops | `FOR`, `WHILE`, `REPEAT` | ✅ Supported | `STEP` supported |
| Routines | `PROCEDURE`, `FUNCTION`, `CALL` | ✅ Supported | `BYREF` caller write-back implemented |
| File operations | `OPENFILE`, `READFILE`, `WRITEFILE`, `EOF`, random-file ops | ✅ Supported | CAIE-style file identifier syntax |
| OOP | `CLASS`, `INHERITS`, `NEW`, methods/properties | ⚠️ Partial | Parser support is broader than runtime behavior |
| Pointers | Pointer type semantics | ❌ Not supported | Decl syntax in guide not yet implemented |
| Constants | `CONSTANT` statement | ⚠️ Partial | Lexer token exists; full statement semantics pending |
| Debugging extension | `DEBUGGER`, step controls, source breakpoints | ⚠️ Extension | Not part of official CAIE pseudocode standard |

## Language Extensions

- `DEBUGGER` is an interpreter extension and not an official CAIE pseudocode keyword.
- Programs that require strict CAIE portability should avoid `DEBUGGER` and rely on standard constructs only.

## Debugger API (Public)

The debugger API is exported from the package entry (`src/index.ts`) via `DebuggerController` and related types.

### Runtime control

- `attachDebugger(controller)` on `Interpreter`
- `detachDebugger()` on `Interpreter`
- `getDebuggerController()` on `Interpreter`

### `DebuggerController` methods

- `onEvent(listener)` subscribe to `paused/resumed` events
- `isPaused()` check current paused state
- `continue()` resume execution
- `stepInto()` pause before next statement
- `stepOver()` step current frame without entering deeper call stack

### Breakpoints

- `setBreakpoints(lines)` replace all line breakpoints
- `addBreakpoint(line)` add line breakpoint
- `removeBreakpoint(line)` remove line breakpoint
- `clearBreakpoints()` clear all line breakpoints
- `getBreakpoints()` list configured line breakpoints
- `setConditionalBreakpoint(line, fn)` set function-based condition
- `setConditionalBreakpointExpression(line, expression)` set string expression condition

### Condition validation and error explanation

- `validateBreakpointConditionExpression(expression)`
  - returns `{ valid: boolean, error?: string }`
- `explainBreakpointConditionError(expression)`
  - returns `null` when valid
  - returns `{ code, message }` when invalid
  - error codes include:
    - `EMPTY_EXPRESSION`
    - `UNTERMINATED_STRING`
    - `UNEXPECTED_CHARACTER`
    - `UNEXPECTED_END`
    - `MISSING_RIGHT_PAREN`
    - `EXPECTED_IDENTIFIER_AFTER_DOT`
    - `EXPECTED_VALUE`
    - `UNEXPECTED_TRAILING_TOKEN`
    - `UNKNOWN`

### Events and payloads

- Event type: `DebugEvent`
  - `paused` with `DebugSnapshot`
  - `resumed` with `DebugSnapshot`
- Pause reasons: `debugger-statement`, `step`, `breakpoint`

### Control Structures
- **Selection**: IF statements, CASE statements
- **Iteration**: FOR loops, WHILE loops, REPEAT loops
- **Procedures and Functions**: With parameter passing by value and reference

### Operations
- **Arithmetic**: +, -, *, /, DIV, MOD
- **Relational**: >, <, >=, <=, =, <>
- **Logical**: AND, OR, NOT
- **String Operations**: Concatenation (&), LENGTH, MID, LEFT, RIGHT, LCASE, UCASE
- **Numeric Functions**: INT, RAND

### File Operations
- **Text Files**: OPENFILE, READFILE, WRITEFILE, CLOSEFILE, EOF
- **Random Files**: SEEK, GETRECORD, PUTRECORD

### Object-Oriented Programming
- **Classes and Objects**: Methods, properties, constructors
- **Inheritance**: Class inheritance with SUPER keyword
- **Access Modifiers**: PUBLIC, PRIVATE

## Implementation Status

### Completed
- [x] Architecture design and documentation
- [x] Project structure creation
- [x] IO interface design
- [x] Component architecture planning

### In Progress
- [x] Core interface implementations
- [x] Lexer development
- [x] Parser development
- [x] Runtime engine development

### Planned
- [x] Type system implementation
- [x] Error handling system
- [ ] Testing framework
- [ ] Documentation and examples

## Getting Started

### Prerequisites
- Node.js (for development and testing)
- TypeScript compiler
- ES2020 compatible environment

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd caie-pseudocode-interpreter

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Basic Usage

```typescript
import { Interpreter } from './src/interpreter';
import { NodeIO } from './src/io/node-adapter';

// Create interpreter with Node.js IO
const io = new NodeIO();
const interpreter = new Interpreter(io);

// Execute pseudocode
const pseudocode = `
DECLARE x : INTEGER
x <- 10
OUTPUT "The value of x is: ", x
`;

interpreter.execute(pseudocode);
```

## Development

### Building the Project
```bash
npm run build
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Documentation

- [Architecture Design](./ARCHITECTURE.md)
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the AGPL.

## Acknowledgments

Based on the Cambridge International AS & A Level Computer Science 9618 pseudocode specification.

This project is an experimental project for vibe coding, and is not intended for production use.

Cooperated with GLM-4.5 & GPT-5.3-Codex.
