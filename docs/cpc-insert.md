## Cambridge International AS & A Level: Computer Science
**Paper 2: Fundamental Problem-solving and Programming Skills**
**9618/21**

---

### Information
* This insert contains all the resources referred to in the questions.
* You may annotate this insert and use the blank spaces for planning. Do not write your answers on the insert.

---

### String and Character Functions
An error will be generated if a function call is not properly formed or if the parameters are of an incorrect type or value.

* **Data Type Rules**:
    * A string of length 1 may be considered as type `CHAR` or `STRING`.
    * A `CHAR` may be assigned to, or concatenated with, a `STRING`.
    * A `STRING` of length greater than 1 cannot be assigned to a `CHAR`.

| Function | Returns | Description & Example |
| :--- | :--- | :--- |
| **LEFT**(`ThisString`: STRING, `x`: INTEGER) | STRING | Returns leftmost `x` characters. <br>Example: `LEFT("ABCDEFGH", 3)` returns `"ABC"`. |
| **RIGHT**(`ThisString`: STRING, `x`: INTEGER) | STRING | Returns rightmost `x` characters. <br>Example: `RIGHT("ABCDEFGH", 3)` returns `"FGH"`. |
| **MID**(`ThisString`: STRING, `x`: INTEGER, `y`: INTEGER) | STRING | Returns string of length `y` starting at position `x`. <br>Example: `MID("ABCDEFGH", 2, 3)` returns `"BCD"`. |
| **LENGTH**(`ThisString`: STRING) | INTEGER | Returns integer value representing the length. <br>Example: `LENGTH("Happy Days")` returns `10`. |
| **TO_UPPER**(`x`: <datatype>) | <datatype> | Converts characters to upper case (`CHAR` or `STRING`). <br>Example: `TO_UPPER('a')` returns `'A'`. |
| **TO_LOWER**(`x`: <datatype>) | <datatype> | Converts characters to lower case (`CHAR` or `STRING`). <br>Example: `TO_LOWER("JIM 803")` returns `"jim 803"`. |
| **NUM_TO_STR**(`x`: REAL/INTEGER) | CHAR/STRING | Returns string representation of a numeric value. <br>Negative values begin with `'-'`. |
| **STR_TO_NUM**(`x`: CHAR/STRING) | REAL/INTEGER | Returns numeric representation of a string. <br>Example: `STR_TO_NUM("23.45")` returns `23.45`. |
| **IS_NUM**(`ThisString`: <datatype>) | BOOLEAN | Returns `TRUE` if string represents a valid numeric value. |
| **ASC**(`ThisChar`: CHAR) | INTEGER | Returns the ASCII value of the character. <br>Example: `ASC('A')` returns `65`. |
| **CHR**(`x`: INTEGER) | CHAR | Returns the character corresponding to the ASCII value `x`. |

---

### Numeric Functions
* **INT**(`x`: REAL) **RETURNS INTEGER**: Returns the integer part of `x`.
    * Example: `INT(27.5415)` returns `27`.
* **RAND**(`x`: INTEGER) **RETURNS REAL**: Returns a real number in the range 0 to `x` (not inclusive of `x`).

---

### Date Functions
Date format is assumed to be **DD/MM/YYYY** unless otherwise stated.

* **DAY**(`ThisDate`: DATE) **RETURNS INTEGER**: Returns day number.
* **MONTH**(`ThisDate`: DATE) **RETURNS INTEGER**: Returns month number.
* **YEAR**(`ThisDate`: DATE) **RETURNS INTEGER**: Returns year number.
* **DAYINDEX**(`ThisDate`: DATE) **RETURNS INTEGER**: Returns index where Sunday = 1, Monday = 2, etc.
* **SETDATE**(`Day`, `Month`, `Year`: INTEGER) **RETURNS DATE**: Returns date object.
* **TODAY()** **RETURNS DATE**: Returns the current system date.

---

### Text File Functions
* **EOF**(`FileName`: STRING) **RETURNS BOOLEAN**: Returns `TRUE` if no more lines can be read.
    * Generates an error if the file is not open in **READ** mode.

---

### Operators

| Operator | Description | Example |
| :--- | :--- | :--- |
| **&** | Concatenates two strings or a `CHAR` with a `STRING`. | `"Summer" & " Pudding"` -> `"Summer Pudding"` |
| **AND** | Logical AND on two Boolean values. | `TRUE AND FALSE` -> `FALSE` |
| **OR** | Logical OR on two Boolean values. | `TRUE OR FALSE` -> `TRUE` |
| **NOT** | Logical NOT on a Boolean value. | `NOT TRUE` -> `FALSE` |
| **MOD** | Finds the remainder of a division. | `10 MOD 3` -> `1` |
| **DIV** | Finds the quotient of a division. | `10 DIV 3` -> `3` |

#### Comparison Operators
Used to compare two items of the same type. Symbols include: `=`, `>`, `<`, `>=`, `<=`, and `<>`.

* **Notes**:
    * May compare `REAL` with `INTEGER` and `CHAR` with `STRING`.
    * Case sensitive for `CHAR` and `STRING`.
    * Cannot be used to compare two records.