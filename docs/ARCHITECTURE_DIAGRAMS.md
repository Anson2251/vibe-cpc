# CAIE Pseudocode Interpreter - Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "Input"
        A[Pseudocode Source]
    end
    
    subgraph "Lexer"
        B[Tokenization]
        C[Token Stream]
    end
    
    subgraph "Parser"
        D[AST Generation]
        E[Abstract Syntax Tree]
    end
    
    subgraph "Runtime"
        F[Execution Engine]
        G[Memory Manager]
        H[Call Stack]
    end
    
    subgraph "IO Layer"
        I[IO Interface]
        J[Console IO]
        K[File IO]
    end
    
    subgraph "Output"
        L[Program Output]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    I --> J
    I --> K
    J --> L
    K --> L
```

## Component Interaction Flow

```mermaid
sequenceDiagram
    participant S as Source Code
    participant L as Lexer
    participant P as Parser
    participant R as Runtime
    participant M as Memory
    participant I as IO Interface
    participant O as Output
    
    S->>L: Pseudocode text
    L->>L: Tokenize
    L->>P: Token stream
    P->>P: Parse AST
    P->>R: AST nodes
    R->>M: Variable operations
    R->>I: IO operations
    I->>O: Display output
    R->>R: Execute statements
```

## Memory Management Architecture

```mermaid
graph TD
    subgraph "Memory Manager"
        A[Global Scope]
        B[Scope Stack]
        C[Current Scope]
    end
    
    subgraph "Scope Structure"
        D[Variables]
        E[Parent Reference]
        F[Child Scopes]
    end
    
    subgraph "Variable Storage"
        G[Name]
        H[Type]
        I[Value]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    D --> I
```

## Type System Mapping

```mermaid
graph LR
    subgraph "CAIE Pseudocode Types"
        A[INTEGER]
        B[REAL]
        C[CHAR]
        D[STRING]
        E[BOOLEAN]
        F[DATE]
        G[ARRAY]
        H[RECORD]
        I[ENUM]
    end
    
    subgraph "TypeScript Types"
        J[number]
        K[string]
        L[boolean]
        M[Date]
        N[Array]
        O[Object]
        P[Enum]
    end
    
    A --> J
    B --> J
    C --> K
    D --> K
    E --> L
    F --> M
    G --> N
    H --> O
    I --> P
```

## Error Handling Flow

```mermaid
graph TD
    subgraph "Error Sources"
        A[Syntax Errors]
        B[Runtime Errors]
        C[Type Errors]
        D[IO Errors]
    end
    
    subgraph "Error Handler"
        E[Error Detection]
        F[Error Classification]
        G[Error Reporting]
    end
    
    subgraph "Error Output"
        H[Error Messages]
        I[Line Numbers]
        J[Recovery Suggestions]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    E --> F
    F --> G
    G --> H
    G --> I
    G --> J
```

## IO Interface Abstraction

```mermaid
graph TD
    subgraph "Core IO Interface"
        A[IOInterface]
        B[input()]
        C[output()]
        D[readFile()]
        E[writeFile()]
        F[appendFile()]
        G[openRandomFile()]
        H[readRecord()]
        I[writeRecord()]
        J[closeFile()]
    end
    
    subgraph "Node.js Implementation"
        K[NodeIO]
        L[fs/promises]
        M[readline]
    end
    
    subgraph "Browser Implementation"
        N[BrowserIO]
        O[prompt()]
        P[alert()]
        Q[localStorage]
        R[IndexedDB]
    end
    
    subgraph "Custom Implementation"
        S[CustomIO]
        T[Custom Backend]
    end
    
    A --> K
    A --> N
    A --> S
    K --> L
    K --> M
    N --> O
    N --> P
    N --> Q
    N --> R
    S --> T
```

## Execution Flow

```mermaid
stateDiagram-v2
    [*] --> Initialize
    Initialize --> Tokenize
    Tokenize --> Parse
    Parse --> Execute
    Execute --> Running
    Running --> Running: Execute Statement
    Running --> Complete: Program End
    Running --> Error: Runtime Error
    Error --> [*]
    Complete --> [*]
```

## Project Structure

```mermaid
graph TD
    subgraph "Root"
        A[src/]
        B[tests/]
        C[examples/]
        D[docs/]
    end
    
    subgraph "Source"
        E[core/]
        F[lexer/]
        G[parser/]
        H[runtime/]
        I[types/]
        J[io/]
        K[errors/]
        L[utils/]
    end
    
    subgraph "Core"
        M[interfaces.ts]
        N[types.ts]
    end
    
    subgraph "Lexer"
        O[lexer.ts]
        P[tokens.ts]
    end
    
    subgraph "Parser"
        Q[parser.ts]
        R[ast.ts]
    end
    
    subgraph "Runtime"
        S[runtime.ts]
        T[memory.ts]
        U[callstack.ts]
    end
    
    A --> E
    A --> F
    A --> G
    A --> H
    A --> I
    A --> J
    A --> K
    A --> L
    E --> M
    E --> N
    F --> O
    F --> P
    G --> Q
    G --> R
    H --> S
    H --> T
    H --> U