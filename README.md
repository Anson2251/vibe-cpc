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
- [ ] Core interface implementations
- [ ] Lexer development
- [ ] Parser development
- [ ] Runtime engine development

### Planned
- [ ] Type system implementation
- [ ] Error handling system
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

This project is licensed under the MIT License.

## Acknowledgments

Based on the Cambridge International AS & A Level Computer Science 9618 pseudocode specification.

This project is a testing codebase for vibe coding, and it is not intended for production use.

Cooperated with GLM-4.5.
