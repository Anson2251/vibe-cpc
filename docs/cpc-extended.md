## CPC Extended Functions

This document describes the extended built-in functions provided by the CPC interpreter beyond the official Cambridge 9618 specification. These functions are designed for teaching convenience and do not introduce any new control flow or statements — they are all pure functions compatible with the structured programming philosophy of the pseudocode specification.

---

### CAIE_ONLY Mode

To restrict the interpreter to only CAIE 9618 standard features, add `// CAIE_ONLY` as the first non-empty line of your program:

```
// CAIE_ONLY
DECLARE x : INTEGER
x <- 5
OUTPUT x
```

When CAIE_ONLY mode is enabled, all extended functions and statements listed below (including `DEBUGGER`, `IMPORT`, `EXPORT`) will produce a runtime error. This is useful for exam preparation and ensuring code complies strictly with the syllabus.

---

### Extended String Functions

| Function | Returns | Description & Example |
| :--- | :--- | :--- |
| **POSITION**(`ThisString`: STRING, `SubString`: STRING) | INTEGER | Returns the starting position of `SubString` within `ThisString`. Returns `0` if not found. Positions are 1-based. <br>Example: `POSITION("Hello World", "World")` returns `7`. <br>Example: `POSITION("Hello", "xyz")` returns `0`. |
| **REPLACE**(`ThisString`: STRING, `OldStr`: STRING, `NewStr`: STRING) | STRING | Returns a string with all occurrences of `OldStr` replaced by `NewStr`. <br>Example: `REPLACE("aabbcc", "b", "X")` returns `"aaXXcc"`. |
| **TRIM**(`ThisString`: STRING) | STRING | Returns the string with leading and trailing whitespace removed. <br>Example: `TRIM("  hello  ")` returns `"hello"`. |

---

### Extended Numeric Functions

* **ROUND**(`x`: REAL, `dp`: INTEGER) **RETURNS REAL**: Returns `x` rounded to `dp` decimal places.
    * Example: `ROUND(3.14159, 2)` returns `3.14`.
    * Example: `ROUND(2.5, 0)` returns `3.0`.
* **ABS**(`x`: REAL) **RETURNS REAL**: Returns the absolute (non-negative) value of `x`.
    * Example: `ABS(-4.7)` returns `4.7`.
    * Example: `ABS(3)` returns `3.0`.
* **SQRT**(`x`: REAL) **RETURNS REAL**: Returns the square root of `x`. Generates an error if `x` is negative.
    * Example: `SQRT(25)` returns `5.0`.
* **POWER**(`x`: REAL, `n`: REAL) **RETURNS REAL**: Returns `x` raised to the power `n`.
    * Example: `POWER(2, 10)` returns `1024.0`.
    * Example: `POWER(9, 0.5)` returns `3.0`.

---

### Extended Type Functions

* **TYPEOF**(`x`: ANY) **RETURNS STRING**: Returns the name of the data type of `x` as a string.
    * Example: `TYPEOF(42)` returns `"INTEGER"`.
    * Example: `TYPEOF(3.14)` returns `"REAL"`.
    * Example: `TYPEOF("hello")` returns `"STRING"`.
    * Example: `TYPEOF('A')` returns `"CHAR"`.
    * Example: `TYPEOF(TRUE)` returns `"BOOLEAN"`.
    * Example: `TYPEOF(TODAY())` returns `"DATE"`.
    * Example: `TYPEOF(NULL)` returns `"NULL"`.

---

### Extended Type System

* **ANY**: A special type that accepts values of any data type. Used in built-in function signatures where a parameter can be of any type. Not intended for use in variable declarations.

---

### IMPORT and EXPORT

The IMPORT and EXPORT extensions provide modularity support for library routines. These are compile-time features — the Linker expands imported files into the main program's AST before evaluation.

#### EXPORT Statement

Controls which declarations (procedures, functions, types, sets, classes) are visible to importing files. By default, **no declarations are exported**. Only top-level declarations can be exported.

**Syntax:**
```
EXPORT Name1, Name2, Name3
```

**Example — library file `mathlib.cpc`:**
```
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

FUNCTION Multiply(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * B
ENDFUNCTION

EXPORT Add, Multiply
```

#### IMPORT Statement (Direct Inclusion)

Imports all exported declarations from another file, making them available directly in the current scope.

**Syntax:**
```
IMPORT "filename"
```

**Example:**
```
IMPORT "mathlib"
OUTPUT Add(3, 4)
OUTPUT Multiply(2, 5)
```

#### IMPORT Expression (Namespace Import)

Imports exported declarations from another file under a namespace. Functions are called using the `namespace.FunctionName()` syntax.

**Syntax:**
```
CONSTANT namespace = IMPORT "filename"
```

**Example:**
```
CONSTANT math = IMPORT "mathlib"
OUTPUT math.Add(3, 4)
OUTPUT math.Multiply(2, 5)
```

#### Rules

* Files without an `EXPORT` statement export nothing — importing such a file has no effect.
* Circular imports are handled gracefully — each file is imported at most once.
* File paths are resolved by appending `.cpc` if no extension is provided.
* IMPORT and EXPORT are blocked in CAIE_ONLY mode.
