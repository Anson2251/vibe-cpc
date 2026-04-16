# Memory Management Redesign - Heap-Based Architecture

## Overview

This document describes the redesign of the interpreter's memory management system to support true pointer semantics as required by the CAIE pseudocode specification. The new architecture replaces the current write-back mechanism for BYREF parameters with a proper heap-based memory model.

## Motivation

The current implementation uses a write-back mechanism to simulate BYREF parameter passing:

```typescript
// Current implementation (evaluator.ts:1470-1473)
// After routine returns, manually copy values back to caller's scope
for (const binding of byRefBindings) {
  const updatedValue = routineEnvironment.get(binding.parameterName);
  this.environment.assign(binding.callerVariable, updatedValue);
}
```

This approach has several limitations:

1. **No true pointers**: Cannot implement pointer types (`^INTEGER`, `^CHAR`)
2. **No memory control**: Users cannot allocate/deallocate memory explicitly
3. **No deep/shallow copy semantics**: All assignments are effectively shallow
4. **Inconsistent with CPC spec**: The language supports pointer types and NEW/DISPOSE

## New Architecture

### Memory Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Runtime Environment                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌──────────────────────────┐  │
│  │   Stack (Scopes)    │      │         Heap             │  │
│  │                     │      │                          │  │
│  │  Environment 1      │      │  ┌─────┬───────────────┐ │  │
│  │  ┌───────────────┐  │      │  │Addr │    Value      │ │  │
│  │  │ x: ptr(100)   │──┼──────┼─►│ 100 │ {value: 42,   │ │  │
│  │  │ y: ptr(101)   │──┼─┐    │  │     │  type: INT,   │ │  │
│  │  └───────────────┘  │ │    │  │     │  refCount: 1} │ │  │
│  │                     │ │    │  ├─────┼───────────────┤ │  │
│  │  Environment 2      │ │    │  │ 101 │ {value: "abc",│ │  │
│  │  ┌───────────────┐  │ └───►│  │     │  type: STRING,│ │  │
│  │  │ p: ptr(100)   │──┼──────┼─►│     │  refCount: 2} │ │  │
│  │  └───────────────┘  │      │  └─────┴───────────────┘ │  │
│  └─────────────────────┘      │                          │  │
│                               │  Free List: [102, 103]   │  │
│                               └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Changes

1. **All variables store pointers**: Variables no longer store values directly
2. **Heap allocation**: Every value lives on the heap with an address
3. **Reference counting**: Track references for copy-on-write and garbage collection
4. **Unified pointer system**: BYREF parameters become pointer passing

## Heap Implementation

### Heap Class

```typescript
// src/runtime/heap.ts

export interface HeapObject {
  value: unknown;
  type: TypeInfo;
  refCount: number;
  isMutable: boolean;
}

export class Heap {
  private memory: Map<number, HeapObject> = new Map();
  private freeList: number[] = [];
  private nextAddress: number = 1;

  allocate(value: unknown, type: TypeInfo): number {
    let address: number;

    // Reuse freed address if available
    if (this.freeList.length > 0) {
      address = this.freeList.pop()!;
    } else {
      address = this.nextAddress++;
    }

    const obj: HeapObject = {
      value: this.deepCopyValue(value, type),
      type,
      refCount: 1,
      isMutable: true,
    };

    this.memory.set(address, obj);
    return address;
  }

  deallocate(address: number): void {
    const obj = this.memory.get(address);
    if (!obj) {
      throw new RuntimeError(`Invalid memory address: ${address}`);
    }

    obj.refCount--;
    if (obj.refCount <= 0) {
      this.memory.delete(address);
      this.freeList.push(address);
    }
  }

  read(address: number): HeapObject {
    const obj = this.memory.get(address);
    if (!obj) {
      throw new RuntimeError(`Invalid memory address: ${address}`);
    }
    return obj;
  }

  write(address: number, value: unknown, type: TypeInfo): void {
    const obj = this.memory.get(address);
    if (!obj) {
      throw new RuntimeError(`Invalid memory address: ${address}`);
    }

    if (!obj.isMutable) {
      throw new RuntimeError("Cannot modify constant");
    }

    obj.value = this.deepCopyValue(value, type);
  }

  incrementRef(address: number): void {
    const obj = this.memory.get(address);
    if (obj) obj.refCount++;
  }

  decrementRef(address: number): void {
    const obj = this.memory.get(address);
    if (obj) {
      obj.refCount--;
      if (obj.refCount <= 0) {
        this.memory.delete(address);
        this.freeList.push(address);
      }
    }
  }

  private deepCopyValue(value: unknown, type: TypeInfo): unknown {
    // Implement recursive deep copy based on type
  }
}
```

### Pointer Type System

```typescript
// src/types/index.ts

export interface PointerTypeInfo {
  kind: "POINTER";
  name: string;
  pointedType: TypeInfo;  // The type being pointed to
}

export type TypeInfo =
  | PseudocodeType
  | ArrayTypeInfo
  | UserDefinedTypeInfo
  | EnumTypeInfo
  | SetTypeInfo
  | PointerTypeInfo;
```

### VariableAtom Changes

```typescript
// src/runtime/variable-atoms.ts

export class VariableAtom {
  // Now stores a pointer address instead of direct value
  address: number;
  type: TypeInfo;
  isConstant: boolean;

  constructor(address: number, type: TypeInfo, isConstant: boolean) {
    this.address = address;
    this.type = type;
    this.isConstant = isConstant;
  }

  getValue(heap: Heap): unknown {
    return heap.read(this.address).value;
  }

  setValue(heap: Heap, value: unknown): void {
    heap.write(this.address, value, this.type);
  }
}
```

## BYREF Rewrite

### Current Implementation

```typescript
// Before: Write-back mechanism
const byRefBindings: Array<{ parameterName: string; callerVariable: string }> = [];

// During call, pass value directly
routineEnvironment.define(param.name, param.type, arg);

// After call, write back
for (const binding of byRefBindings) {
  const updatedValue = routineEnvironment.get(binding.parameterName);
  this.environment.assign(binding.callerVariable, updatedValue);
}
```

### New Implementation

```typescript
// After: Pointer passing

if (param.mode === ParameterMode.BY_REFERENCE) {
  // Get the address of the caller's variable
  const callerAtom = this.environment.getAtom(argNode.name);
  // Pass the address, not the value
  routineEnvironment.define(param.name, param.type, callerAtom.address);
} else {
  // BYVAL: allocate new memory and copy value
  const newAddr = this.heap.allocate(arg, param.type);
  routineEnvironment.define(param.name, param.type, newAddr);
}
```

### Benefits

1. **Consistent with pointer types**: BYREF now uses the same mechanism as pointer variables
2. **O(1) access**: No need to search and assign after routine returns
3. **Supports nested mutation**: Changes to nested data structures are visible immediately

## Pointer Implementation

### Pointer Type Declaration

```typescript
// Parser handling
TYPE TIntPointer = ^INTEGER
TYPE TCharPointer = ^CHAR
TYPE StudentPtr = ^StudentRecord
```

### Pointer Operations

| Operation | Syntax | Description |
|-----------|--------|-------------|
| New pointer | `DECLARE p : TIntPointer` | Declare pointer variable (initially NULL) |
| Address-of | `p <- ^x` | Get address of variable x |
| Dereference | `x <- p^` | Get value at address p |
| NULL | `p <- NULL` | Set pointer to null |

### Implementation

```typescript
// src/runtime/evaluator.ts

// Handle pointer type declaration
case "PointerType":
  return PointerTypeInfo {
    kind: "POINTER",
    name: typeName,
    pointedType: resolveType(pointedTypeName),
  };

// Handle address-of operator (^x)
case "AddressOf":
  const targetAtom = this.environment.getAtom(expr.variable);
  return targetAtom.address;  // Return address as pointer value

// Handle dereference (p^)
case "PointerDereference":
  const ptrValue = await this.evaluate(expr.pointer);
  if (ptrValue === null) {
    throw new RuntimeError("Null pointer dereference");
  }
  return this.heap.read(ptrValue).value;

// Handle NEW (allocate memory)
case "NewExpression":
  const newAddr = this.heap.allocate(initialValue, pointedType);
  return newAddr;

// Handle DISPOSE (free memory)
case "DisposeStatement":
  const addr = await this.evaluate(expr.pointer);
  this.heap.deallocate(addr);
```

### NULL Handling

```typescript
// Special address 0 represents NULL
const NULL_POINTER = 0;

// In heap operations
isNullPointer(address: number): boolean {
  return address === NULL_POINTER;
}
```

## Deep/Shallow Copy Semantics

### Current Behavior

All assignments create shallow copies:

```pseudocode
DECLARE A : ARRAY[1:3] OF INTEGER
DECLARE B : INTEGER
A[1] <- 1
B <- A         // B gets copy of reference? Value?
```

### New Behavior

```typescript
// Assignment creates new allocation (deep copy)
assign(name: string, value: number): void {
  const oldAtom = this.variables.get(name);
  if (oldAtom) {
    this.heap.decrementRef(oldAtom.address);
  }

  // Allocate new memory and copy
  const newAddr = this.heap.allocate(value, this.type);
  this.variables.set(name, new VariableAtom(newAddr, ...));
}

// For pointer assignment, refCount only (shallow copy)
assignPointer(name: string, sourceAddr: number): void {
  const oldAtom = this.variables.get(name);
  if (oldAtom) {
    this.heap.decrementRef(oldAtom.address);
  }

  this.heap.incrementRef(sourceAddr);
  this.variables.set(name, sourceAddr);
}
```

### Copy Modes

| Context | Behavior |
|---------|----------|
| `B <- A` (scalar) | Deep copy (new allocation) |
| `B <- A` (array) | Deep copy (recursive) |
| `B <- A` (record) | Deep copy (recursive) |
| `P <- Q` (pointer) | Shallow copy (refCount only) |
| BYVAL parameter | Deep copy |
| BYREF parameter | Pass address (no copy) |

## Implementation Roadmap

### Phase 1: Heap Infrastructure
1. Create `Heap` class with allocate/deallocate/read/write
2. Implement reference counting
3. Add NULL pointer handling

### Phase 2: Type System Extension
1. Add `PointerTypeInfo` to type definitions
2. Update parser to handle `^<type>` syntax
3. Add pointer type validation

### Phase 3: Environment Rewrite
1. Modify `VariableAtom` to store addresses
2. Update `Environment` to use heap for all operations
3. Implement deep/shallow copy logic

### Phase 4: BYREF Refactoring
1. Replace write-back with pointer passing
2. Update procedure/function call handling
3. Add tests for BYREF semantics

### Phase 5: Pointer Operations
1. Implement `^x` (address-of)
2. Implement `p^` (dereference)
3. Implement `NEW`/`DISPOSE`

### Phase 6: Testing and Optimization
1. Comprehensive test suite
2. Performance optimization
3. Memory leak detection

## File Changes Summary

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `PointerTypeInfo` |
| `src/runtime/heap.ts` | New file - Heap implementation |
| `src/runtime/variable-atoms.ts` | Store addresses instead of values |
| `src/runtime/environment.ts` | Use heap for all operations |
| `src/runtime/evaluator.ts` | Pointer operations, new BYREF |
| `src/parser/parser.ts` | Handle pointer type syntax |

## Backward Compatibility

This is a breaking change to internal implementation. External API remains the same:

- Variable declaration/assignment syntax unchanged
- BYREF syntax unchanged
- Existing programs should produce same results

The change is transparent to users but enables:
- True pointer types
- Manual memory management (NEW/DISPOSE)
- Correct deep/shallow copy semantics
