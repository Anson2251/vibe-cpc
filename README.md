# CAIE Pseudocode Interpreter

A TypeScript interpreter for the CAIE (Cambridge Assessment International Education) pseudocode language, designed to be ES2020 compatible and environment-agnostic.

## Features

- **Complete CAIE Specification Support**: Implements all language features from the CAIE pseudocode guide
- **ES2020 Compatible**: No Node.js dependencies, works in any ES2020 environment
- **Environment Agnostic**: Runs in Node.js, browsers, and other JavaScript environments
- **Modular Architecture**: Clean separation of concerns with pluggable components
- **Comprehensive Error Handling**: Detailed error messages with line and column information
- **Type System**: Robust type checking and conversion
- **Built-in Debugger Extension**: Supports `DEBUGGER` statement, stepping, and source breakpoints

## Architecture

The interpreter follows a modular architecture with clear separation of concerns:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Lexer       │───▶│     Parser      │───▶│     Linker      │───▶│    Runtime      │
│  (Tokenization) │    │  (AST Building) │    │ (AST Expansion) │    │ (Execution)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
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

```
src/
├── cli/              # CLI adapters
├── errors/           # Error handling
├── io/               # IO interface abstractions
├── lexer/            # Tokenization
├── parser/           # AST generation
├── runtime/          # Execution engine
└── types/           # Type definitions
```

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
| Constants | `CONSTANT` statement | ✅ Supported | Full statement semantics including type inference |
| Modularity | `IMPORT`, `EXPORT` | ⚠️ Extension | Compile-time AST expansion; blocked in CAIE_ONLY mode |
| Strict mode | `// CAIE_ONLY` comment | ⚠️ Extension | Restricts to CAIE standard features only |
| Extended functions | POSITION, ROUND, ABS, SQRT, REPLACE, TRIM, POWER, TYPEOF | ⚠️ Extension | Blocked in CAIE_ONLY mode |
| Debugging extension | `DEBUGGER`, step controls, source breakpoints | ⚠️ Extension | Not part of official CAIE pseudocode standard |

## Language Extensions

Beyond the official CAIE pseudocode specification, the interpreter provides several extensions for teaching convenience and modularity. All extensions are blocked when CAIE_ONLY mode is enabled.

### CAIE_ONLY Mode

Add `// CAIE_ONLY` as the first non-empty line of your program to restrict the interpreter to CAIE 9618 standard features only. This is useful for exam preparation and ensuring code complies strictly with the syllabus.

### Extended Built-in Functions

| Category | Functions | Description |
| --- | --- | --- |
| String | `POSITION`, `REPLACE`, `TRIM` | Substring search, replacement, and whitespace trimming |
| Numeric | `ROUND`, `ABS`, `SQRT`, `POWER` | Rounding, absolute value, square root, exponentiation |
| Type | `TYPEOF` | Returns the declared type name of a value as a string |

### IMPORT and EXPORT

Compile-time modularity support for library routines:

- **`EXPORT Name1, Name2`** — Controls which declarations are visible to importers (default: nothing is exported)
- **`IMPORT "filename"`** — Direct inclusion of exported declarations
- **`CONSTANT ns = IMPORT "filename"`** — Namespace import, accessed via `ns.FunctionName()`

See [cpc-extended.md](docs/cpc-extended.md) for full details.

### Debugger Extension

`DEBUGGER` is an interpreter extension and not an official CAIE pseudocode keyword. Programs that require strict CAIE portability should avoid `DEBUGGER` and rely on standard constructs only.

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
- **String Operations**: Concatenation (&), LENGTH, MID, LEFT, RIGHT, LCASE, UCASE, POSITION, REPLACE, TRIM
- **Numeric Functions**: INT, RAND, ROUND, ABS, SQRT, POWER
- **Type Functions**: TYPEOF

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
- [x] Core interface implementations
- [x] Lexer development
- [x] Parser development
- [x] Runtime engine development

### In Progress
- [x] Type system implementation
- [x] Error handling system
- [ ] Testing framework
- [ ] Documentation and examples

### Planned
- [ ] Portable binary executable

## Getting Started

### Prerequisites
- Node.js (for development and testing)
- TypeScript compiler
- ES2020 compatible environment

### Installation
```bash
# Clone the repository
git clone https://github.com/Anson2251/vibe-cpc.git
cd vibe-cpc

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test
```

## Usage

```typescript
import { Interpreter } from './src/index';
import { NodeIO } from './src/io/node-io-impl';

const io = new NodeIO();
const interpreter = new Interpreter(io);

const result = interpreter.execute(`
DECLARE x : INTEGER
x <- 10
OUTPUT "x = ", x
`);

console.log(result);
```

## Development

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

## License

AGPL

## Acknowledgments

Based on Cambridge International AS & A Level Computer Science 9618 pseudocode specification.

This project is heavily inspired by [iewnfod/CAIE_Code](https://github.com/iewnfod/CAIE_Code).

Cooperated with GLM-4.5 & GPT-5.3-Codex.
