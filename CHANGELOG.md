# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.1] - 2026-04-18

Initial alpha release of the Vibe CPC.

### Added

#### Core Language
- Complete 9618 pseudocode specification support
- Variable declarations with type inference (`DECLARE`, `CONSTANT`)
- Primitive types: `INTEGER`, `REAL`, `CHAR`, `STRING`, `BOOLEAN`, `DATE`
- Arrays with multi-dimensional support (`ARRAY[lower:upper] OF <type>`)
- User-defined types: Records (`TYPE ... ENDTYPE`), Enumerations, Sets
- Selection: `IF`/`ELSE`/`ENDIF`, `CASE`/`ENDCASE`
- Iteration: `FOR`/`NEXT`, `WHILE`/`ENDWHILE`, `REPEAT`/`UNTIL`
- Procedures and functions with `BYREF` parameter support
- String operations: `LENGTH`, `MID`, `LEFT`, `RIGHT`, `LCASE`, `UCASE`, concatenation (`&`)
- Numeric functions: `INT`, `RAND`, `ROUND`, `ABS`, `SQRT`, `POWER`
- Type function: `TYPEOF`
- Relational and logical operators: `=`, `<>`, `>`, `<`, `>=`, `<=`, `AND`, `OR`, `NOT`
- Arithmetic operators: `+`, `-`, `*`, `/`, `DIV`, `MOD`

#### Object-Oriented Programming
- Class declarations with methods, properties, and constructors
- Inheritance with `INHERITS` and `SUPER` keyword
- Access modifiers: `PUBLIC`, `PRIVATE`
- Method overriding and resolution

#### Pointers
- Pointer types (`^type`)
- Dereference (`p^`) and address-of (`^x`) operators
- `NULL` pointer assignment and comparison
- `DISPOSE` for freeing pointer memory
- Heap memory management

#### File Operations
- Text files: `OPENFILE`, `READFILE`, `WRITEFILE`, `CLOSEFILE`, `EOF`
- Random file access: `SEEK`, `GETRECORD`, `PUTRECORD`

#### Extensions (blocked in CAIE_ONLY mode)
- `IMPORT`/`EXPORT` modularity system with namespace imports
- `CAIE_ONLY` strict mode via `// CAIE_ONLY` comment
- Extended built-in functions: `POSITION`, `REPLACE`, `TRIM`, `ROUND`, `ABS`, `SQRT`, `POWER`, `TYPEOF`
- `DEBUGGER` statement with step/breakpoint controls
- `DebuggerController` API: `stepInto`, `stepOver`, `continue`, conditional breakpoints

#### CLI
- Execute pseudocode from file (`-f, --file`)
- Execute from string (`-c, --code`)
- Verbose mode with execution time and steps (`--verbose`)
- JSON output mode for tokens and AST (`-o json`)
- Node.js CLI adapter and QuickJS CLI adapter

#### API
- `Interpreter` class with `execute`, `executeFile`, `analyze`, `dispose` methods
- Convenience functions: `execute`, `executeFile`, `createInterpreter`
- Environment-agnostic IO interface (`IOInterface`)
- Node.js, Browser, and QuickJS IO implementations

#### Build & Infrastructure
- Rolldown-based build producing CJS and ESM bundles
- Standalone binary build via QuickJS compilation (Linux, macOS, Windows)
- Vitest test suite with 600 tests across 37 files
- Oxlint and Oxfmt for linting and formatting
- TypeScript type checking via `tsgo`
- GitHub Actions release workflow for automated binary builds
