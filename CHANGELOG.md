# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.4] - 2026-04-20

### Added
- `DO` keyword is now optional in `WHILE` loops
- Debugger error snapshot support with expanded test coverage
- Array index errors now include line and column information
- Error reporting for certain routines now includes line and column information
- Async support for expressions in assignments and array access
- Copy-on-Write optimization for runtime performance
- Integration tests for array parameter passing and simple array operations
- Error location test suite (`error-location.test.ts`)

### Changed
- **Performance**: Copy-on-Write and trampoline improvements for better runtime performance
- Environment module refactored for better variable tracking
- Heap module refactored with improved object management
- Trampoline engine refactored with improved seq/loop handling
- Variable atoms module expanded with additional helper functions
- Evaluator types module updated for better type safety
- Array helpers module updated for better array manipulation
- Debugger module updated with error snapshot support
- Lexer updated to support optional `DO` keyword in WHILE loops
- Parser updated to handle subtraction expressions in array indices (e.g., `data[i-1]`)
- Browser index updated with additional exports
- Interpreter updated with improved execution flow

### Fixed
- Subtraction expressions in array indices (e.g., `data[i-1]`) now parse correctly
- Line and column tracking for error reporting in certain routines
- Various linter complaints resolved

## [0.1.0-alpha.3] - 2026-04-20

### Added
- Performance benchmark suite (`profile-hard`) with 27 tests covering lexer, parser, loops, recursion, arrays, strings, OOP, procedures, algorithms, and records
- Performance benchmarks section in README with averaged results over 5 runs

### Changed
- **Performance**: Remove `neverthrow` from evaluator hot path for faster execution
- **Performance**: Add unsafe heap methods (`getObjectUnsafe`, `setObjectUnsafe`) to bypass bounds checking
- **Performance**: Cache class definitions to avoid repeated lookups during object creation
- **Performance**: Optimize sequential program evaluation with direct trampoline execution
- **Performance**: Optimize trampoline engine with fast paths for loop conditions, body execution, and IO operations
- **Performance**: Extract type resolution, array helpers, OOP helpers, record serializer, and variable atoms into dedicated modules
- Refactor evaluator into modular helper modules (`evaluator-types.ts`, `oop-helpers.ts`, `record-serializer.ts`, `type-resolver.ts`, `array-helpers.ts`)
- Refactor heap to use unsafe access methods for internal operations
- Update README: remove duplicate feature sections, add software version info to benchmarks

### Fixed
- Remove unused `originalAfter` variable in trampoline sequence-to-loop conversion
- Remove unnecessary type assertions (`as OutputNode`, `as ReturnNode`) in evaluator
- Add `async` keyword to `debugPause` callbacks to satisfy `promise-function-async` lint rule

## [0.1.0-alpha.2] - 2026-04-18

### Fixed
- Add shebang (`#!/usr/bin/env node`) to CLI entry for correct `npx` execution
- Move `neverthrow` and `zod` to devDependencies (already bundled by rolldown)
- Add `.npmignore` to exclude sourcemaps and dev files from npm package

### Changed
- Simplify README installation section with `npx` one-liner
- Add standalone binary motivation to README

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
