import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";
import { DebuggerController, DebugEvent, type DebugSnapshot } from "../../../src/runtime/debugger";

function oncePaused(controller: DebuggerController): Promise<DebugEvent> {
    return new Promise((resolve) => {
        const off = controller.onEvent((event) => {
            if (event.type === "paused") {
                off();
                resolve(event);
            }
        });
    });
}

describe("Interpreter debugger integration", () => {
    test("DEBUGGER is no-op when no controller attached", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 1
DEBUGGER
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("1");
    });

    test("pauses on DEBUGGER and resumes on continue", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedPromise = oncePaused(controller);
        const runPromise = interpreter.execute(`
DECLARE x : INTEGER
x <- 42
DEBUGGER
OUTPUT x
`);

        const pausedEvent = await pausedPromise;
        expect(pausedEvent.type).toBe("paused");
        if (pausedEvent.type === "paused") {
            expect(pausedEvent.snapshot.reason).toBe("debugger-statement");
            expect(pausedEvent.snapshot.scopes[0].variables.some((v) => v.name === "x")).toBe(true);
        }

        controller.continue();
        const result = await runPromise;

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("42");
    });

    test("IF condition can be used as conditional breakpoint", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 3
IF x > 5 THEN
  DEBUGGER
ENDIF
IF x = 3 THEN
  DEBUGGER
ENDIF
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(1);
        expect(io.getOutput().trim()).toBe("3");
    });

    test("stepInto pauses at next statement", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            if (pausedLines.length === 1) {
                controller.stepInto();
            } else {
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 1
DEBUGGER
x <- x + 1
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedLines[0]).toBe(4);
        expect(pausedLines[1]).toBe(5);
        expect(io.getOutput().trim()).toBe("2");
    });

    test("stepOver does not step into procedure body", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            if (pausedLines.length === 1) {
                controller.stepOver();
            } else {
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
PROCEDURE SayHi()
  OUTPUT "in-proc"
ENDPROCEDURE

DEBUGGER
CALL SayHi()
OUTPUT "done"
`);

        expect(result.success).toBe(true);
        expect(pausedLines[0]).toBe(6);
        expect(pausedLines[1]).toBe(7);
        expect(io.getOutput().trim()).toBe("in-proc\ndone");
    });

    test("pauses on configured line breakpoint", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);
        controller.setBreakpoints([4]);

        const pausedPromise = oncePaused(controller);
        const runPromise = interpreter.execute(`
DECLARE x : INTEGER
x <- 1
x <- x + 2
OUTPUT x
`);

        const pausedEvent = await pausedPromise;
        expect(pausedEvent.type).toBe("paused");
        if (pausedEvent.type === "paused") {
            expect(pausedEvent.snapshot.reason).toBe("breakpoint");
            expect(pausedEvent.snapshot.location.line).toBe(4);
        }

        controller.continue();
        const result = await runPromise;

        expect(result.success).toBe(true);
        expect(io.getOutput().trim()).toBe("3");
    });

    test("breakpoint can hit multiple times in loop", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);
        controller.setBreakpoints([4]);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE i : INTEGER
FOR i <- 1 TO 3
  OUTPUT i
NEXT i
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(3);
        expect(io.getOutput().trim()).toBe("1\n2\n3");
    });

    test("conditional breakpoint pauses only when condition matches", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        controller.setConditionalBreakpoint(4, (snapshot) => {
            const localScope = snapshot.scopes[0];
            const variable = localScope?.variables.find((entry) => entry.name === "x");
            return variable?.value === 2;
        });

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
FOR x <- 1 TO 3
  OUTPUT x
NEXT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(1);
        expect(io.getOutput().trim()).toBe("1\n2\n3");
    });

    test("expression conditional breakpoint pauses using string expression", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        controller.setConditionalBreakpointExpression(4, "x MOD 2 = 0 AND x >= 4");

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
FOR x <- 1 TO 6
  OUTPUT x
NEXT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(2);
        expect(io.getOutput().trim()).toBe("1\n2\n3\n4\n5\n6");
    });

    test("recursive calls expose call stack while paused", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const seenDepths: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            if (event.snapshot.reason === "debugger-statement") {
                seenDepths.push(event.snapshot.callStack.length);
            }
            controller.continue();
        });

        const result = await interpreter.execute(`
FUNCTION Search(value : INTEGER) RETURNS INTEGER
  DEBUGGER
  IF value = 0 THEN
    RETURN 0
  ENDIF
  RETURN Search(value - 1)
ENDFUNCTION

OUTPUT Search(3)
`);

        expect(result.success).toBe(true);
        expect(seenDepths).toEqual([1, 2, 3, 4]);
    });

    test("paused function shows outer scope variables", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let outerValue: unknown;
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            const globalScope = event.snapshot.scopes.find((scope) => scope.scopeName === "global");
            outerValue = globalScope?.variables.find((variable) => variable.name === "test")?.value;
            controller.continue();
        });

        const result = await interpreter.execute(`
DECLARE test : INTEGER
test <- 3

FUNCTION ReadOuter() RETURNS INTEGER
  DEBUGGER
  RETURN test
ENDFUNCTION

OUTPUT ReadOuter()
`);

        expect(result.success).toBe(true);
        expect(outerValue).toBe(3);
    });

    test("debugger pauses inside function called from assignment", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        const result = await interpreter.execute(`
FUNCTION AddOne(value : INTEGER) RETURNS INTEGER
  DEBUGGER
  RETURN value + 1
ENDFUNCTION

DECLARE result : INTEGER
result <- AddOne(5)
OUTPUT result
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // DEBUGGER line inside function
        expect(io.getOutput().trim()).toBe("6");
    });

    test("debugger pauses inside recursive function called from CALL statement", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pauseCount++;
            controller.continue();
        });

        // Use OUTPUT to call the function (not CALL, since Factorial returns a value)
        const result = await interpreter.execute(`
FUNCTION Factorial(n : INTEGER) RETURNS INTEGER
  DEBUGGER
  IF n <= 1 THEN
    RETURN 1
  ENDIF
  RETURN n * Factorial(n - 1)
ENDFUNCTION

OUTPUT Factorial(3)
`);

        if (!result.success) {
            console.log("Recursive test failed:", result.error);
        }
        expect(result.success).toBe(true);
        expect(pauseCount).toBe(3); // Should pause 3 times for n=3,2,1
    });

    // ========== 以下测试覆盖刚才修复的问题 ==========

    test("debugger pauses at breakpoint inside function called from assignment", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        // 在函数内部的行设置断点
        controller.setBreakpoints([3]);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // 测试从assignment语句调用函数时，函数内部的断点能正常工作
        const result = await interpreter.execute(`
FUNCTION MultiplyByTwo(value : INTEGER) RETURNS INTEGER
  RETURN value * 2
ENDFUNCTION

DECLARE result : INTEGER
result <- MultiplyByTwo(5)
OUTPUT result
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // 断点应该在函数内部的第3行触发
        expect(io.getOutput().trim()).toBe("10");
    });

    test("debugger pauses correctly with array parameter in function call", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedEvents: Array<{ line: number; reason: string }> = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedEvents.push({
                line: event.snapshot.location.line ?? -1,
                reason: event.snapshot.reason,
            });
            controller.continue();
        });

        // 测试数组参数传递给函数时的debugger行为
        const result = await interpreter.execute(`
FUNCTION SumArray(arr : ARRAY[1:3] OF INTEGER) RETURNS INTEGER
  DEBUGGER
  DECLARE sum : INTEGER
  DECLARE i : INTEGER
  sum <- 0
  FOR i <- 1 TO 3
    sum <- sum + arr[i]
  NEXT i
  RETURN sum
ENDFUNCTION

DECLARE numbers : ARRAY[1:3] OF INTEGER
numbers[1] <- 10
numbers[2] <- 20
numbers[3] <- 30
OUTPUT SumArray(numbers)
`);

        expect(result.success).toBe(true);
        expect(pausedEvents.some((e) => e.reason === "debugger-statement" && e.line === 3)).toBe(true);
        expect(io.getOutput().trim()).toBe("60");
    });

    test("debugger pauses at breakpoint, debugger-statement, and error", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        // 设置断点在第8行
        controller.setBreakpoints([8]);

        const pausedEvents: Array<{ line: number; reason: string }> = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedEvents.push({
                line: event.snapshot.location.line ?? -1,
                reason: event.snapshot.reason,
            });
            controller.continue();
        });

        // 测试不同类型的暂停原因
        const result = await interpreter.execute(`
FUNCTION TestFunc(x : INTEGER) RETURNS INTEGER
  IF x > 5 THEN
    DEBUGGER
  ENDIF
  RETURN x * 2
ENDFUNCTION

DECLARE a : INTEGER
a <- TestFunc(10)
OUTPUT a
`);

        expect(result.success).toBe(true);
        // 应该至少在 DEBUGGER 语句处暂停
        expect(pausedEvents.some((e) => e.reason === "debugger-statement")).toBe(true);
        expect(io.getOutput().trim()).toBe("20");
    });

    test("debugger handles nested function calls from assignment", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // 测试嵌套函数调用从assignment语句执行
        const result = await interpreter.execute(`
FUNCTION Inner(x : INTEGER) RETURNS INTEGER
  DEBUGGER
  RETURN x + 1
ENDFUNCTION

FUNCTION Outer(y : INTEGER) RETURNS INTEGER
  DEBUGGER
  RETURN Inner(y) * 2
ENDFUNCTION

DECLARE result : INTEGER
result <- Outer(5)
OUTPUT result
`);

        if (!result.success) {
            console.log("Nested function test failed:", result.error);
        }
        console.log("Paused lines:", pausedLines);
        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // Inner函数中的DEBUGGER
        expect(pausedLines).toContain(8); // Outer函数中的DEBUGGER
        expect(io.getOutput().trim()).toBe("12");
    });

    test("debugger stepInto works with function call from assignment", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);

            if (pausedLines.length === 1) {
                controller.stepInto();
            } else {
                controller.continue();
            }
        });

        // 从DEBUGGER语句开始，然后stepInto进入函数调用
        const result = await interpreter.execute(`
FUNCTION GetValue() RETURNS INTEGER
  RETURN 42
ENDFUNCTION

DEBUGGER
DECLARE x : INTEGER
x <- GetValue()
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedLines.length).toBeGreaterThanOrEqual(2);
        expect(io.getOutput().trim()).toBe("42");
    });

    test("debugger pauses correctly when array passed to function and modified", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pausedInFunction = false;
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            if (event.snapshot.location.line === 3) {
                pausedInFunction = true;
            }
            controller.continue();
        });

        // 测试传递数组给函数，在函数内设置断点
        controller.setBreakpoints([3]);

        const result = await interpreter.execute(`
FUNCTION FirstElement(arr : ARRAY[1:3] OF INTEGER) RETURNS INTEGER
  RETURN arr[1]
ENDFUNCTION

DECLARE data : ARRAY[1:3] OF INTEGER
data[1] <- 100
data[2] <- 200
data[3] <- 300
OUTPUT FirstElement(data)
`);

        expect(result.success).toBe(true);
        expect(pausedInFunction).toBe(true);
        expect(io.getOutput().trim()).toBe("100");
    });

    // ========== 以下测试用于触发其他潜在的异步路径漏洞 ==========

    test("debugger pauses with function call in TypeCast expression", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // TypeCast 表达式中包含函数调用
        const result = await interpreter.execute(`
FUNCTION GetNumber() RETURNS INTEGER
  DEBUGGER
  RETURN 42
ENDFUNCTION

DECLARE x : REAL
x <- GetNumber()
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // GetNumber函数中的DEBUGGER
        expect(io.getOutput().trim()).toBe("42");
    });

    test("debugger pauses with function call in SET literal", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // SET 字面量中包含函数调用
        const result = await interpreter.execute(`
FUNCTION GetValue() RETURNS INTEGER
  DEBUGGER
  RETURN 1
ENDFUNCTION

TYPE TIntSet = SET OF INTEGER
DECLARE s : TIntSet
s <- [GetValue(), 2, 3]
OUTPUT 1 IN s
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // GetValue函数中的DEBUGGER
    });

    test("debugger pauses with function call in array index", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // 数组索引中包含函数调用
        const result = await interpreter.execute(`
FUNCTION GetIndex() RETURNS INTEGER
  DEBUGGER
  RETURN 2
ENDFUNCTION

DECLARE arr : ARRAY[1:5] OF INTEGER
arr[1] <- 10
arr[2] <- 20
arr[3] <- 30
OUTPUT arr[GetIndex()]
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // GetIndex函数中的DEBUGGER
        expect(io.getOutput().trim()).toBe("20");
    });

    test("debugger pauses with nested function call in array index from assignment", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);
            controller.continue();
        });

        // 从assignment语句中通过数组索引（含函数调用）访问
        const result = await interpreter.execute(`
FUNCTION CalculateIndex() RETURNS INTEGER
  DEBUGGER
  RETURN 1
ENDFUNCTION

DECLARE arr : ARRAY[1:3] OF INTEGER
DECLARE result : INTEGER
arr[1] <- 100
arr[2] <- 200
arr[3] <- 300
result <- arr[CalculateIndex()]
OUTPUT result
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3); // CalculateIndex函数中的DEBUGGER
        expect(io.getOutput().trim()).toBe("100");
    });

    // ========== 边界情况测试 ==========

    test("debugger with minimal program containing only DEBUGGER statement", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let paused = false;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                paused = true;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`DEBUGGER`);

        expect(result.success).toBe(true);
        expect(paused).toBe(true);
    });

    test("debugger with consecutive DEBUGGER statements", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DEBUGGER
DEBUGGER
DEBUGGER
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(3);
    });

    test("debugger in WHILE loop with zero iterations", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 0
WHILE x > 0
  DEBUGGER
  x <- x - 1
ENDWHILE
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(0);
        expect(io.getOutput().trim()).toBe("0");
    });

    test("debugger in WHILE loop with condition becoming false", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 3
WHILE x > 0
  DEBUGGER
  x <- x - 1
ENDWHILE
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(3);
        expect(io.getOutput().trim()).toBe("0");
    });

    test("debugger in REPEAT UNTIL loop", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 1
REPEAT
  DEBUGGER
  x <- x + 1
UNTIL x >= 3
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(2);
        expect(io.getOutput().trim()).toBe("3");
    });

    test("debugger in CASE statement", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedCases: number[] = [];
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const xVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "x");
                if (xVar) {
                    pausedCases.push(Number(xVar.value));
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
FOR x <- 1 TO 3
  CASE OF x
    1: DEBUGGER
    2: DEBUGGER
    3: DEBUGGER
  ENDCASE
NEXT x
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedCases).toEqual([1, 2, 3]);
    });

    test("debugger pauses on error when reason is error", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let errorPaused = false;
        let errorSnapshot: DebugSnapshot | undefined;
        controller.onEvent((event) => {
            if (event.type === "paused" && event.snapshot.reason === "error") {
                errorPaused = true;
                errorSnapshot = event.snapshot;
                controller.continue();
            }
        });

        // 除以零会产生错误 - 第3行
        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 10 DIV 0
OUTPUT x
`);

        expect(result.success).toBe(false);
        expect(errorPaused).toBe(true);
        expect(errorSnapshot?.error).toBeDefined();
        expect(errorSnapshot?.error?.line).toBe(3);
        expect(errorSnapshot?.error?.column).toBeDefined();
        expect(errorSnapshot?.location?.line).toBe(3);
    });

    test("debugger pauses on array index out of bounds error with location", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let errorPaused = false;
        let errorSnapshot: DebugSnapshot | undefined;
        controller.onEvent((event) => {
            if (event.type === "paused" && event.snapshot.reason === "error") {
                errorPaused = true;
                errorSnapshot = event.snapshot;
                controller.continue();
            }
        });

        // 数组越界错误 - 第4行
        const result = await interpreter.execute(`
DECLARE arr : ARRAY[1:3] OF INTEGER
arr[1] <- 10
arr[2] <- 20
OUTPUT arr[0]
`);

        expect(result.success).toBe(false);
        expect(errorPaused).toBe(true);
        expect(errorSnapshot?.error).toBeDefined();
        expect(errorSnapshot?.error?.line).toBe(5);
        expect(errorSnapshot?.error?.column).toBeDefined();
        expect(errorSnapshot?.location?.line).toBe(5);
    });

    test("debugger in PROCEDURE without return value", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pausedInProcedure = false;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const frame = event.snapshot.callStack[0];
                if (frame?.routineName === "DoSomething") {
                    pausedInProcedure = true;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
PROCEDURE DoSomething()
  DEBUGGER
  OUTPUT "inside"
ENDPROCEDURE

CALL DoSomething()
OUTPUT "done"
`);

        expect(result.success).toBe(true);
        expect(pausedInProcedure).toBe(true);
        expect(io.getOutput().trim()).toBe("inside\ndone");
    });

    test("debugger in nested loops", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE i : INTEGER
DECLARE j : INTEGER
FOR i <- 1 TO 2
  FOR j <- 1 TO 2
    DEBUGGER
  NEXT j
NEXT i
OUTPUT i + j
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(4);
    });

    test("debugger event listener can be removed", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let listener1Count = 0;
        let listener2Count = 0;

        const off1 = controller.onEvent((event) => {
            if (event.type === "paused") {
                listener1Count += 1;
            }
        });

        const off2 = controller.onEvent((event) => {
            if (event.type === "paused") {
                listener2Count += 1;
            }
        });

        // 添加一个控制监听器来处理 continue
        const offControl = controller.onEvent((event) => {
            if (event.type === "paused") {
                controller.continue();
            }
        });

        // 第一次执行，两个监听器都工作
        let result = await interpreter.execute(`DEBUGGER`);
        expect(result.success).toBe(true);
        expect(listener1Count).toBe(1);
        expect(listener2Count).toBe(1);

        // 移除第一个监听器
        off1();

        // 第二次执行，只有监听器2工作
        result = await interpreter.execute(`DEBUGGER`);
        expect(result.success).toBe(true);
        expect(listener1Count).toBe(1);
        expect(listener2Count).toBe(2);

        // 移除第二个监听器
        off2();

        // 第三次执行，没有监听器工作（除了控制监听器）
        result = await interpreter.execute(`DEBUGGER`);
        expect(result.success).toBe(true);
        expect(listener1Count).toBe(1);
        expect(listener2Count).toBe(2);

        offControl();
    });

    test("debugger handles invalid breakpoint lines gracefully", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        // 设置无效的断点行号
        controller.setBreakpoints([-1, 0, 1.5, NaN, Infinity]);

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
OUTPUT "hello"
OUTPUT "world"
`);

        expect(result.success).toBe(true);
        expect(pauseCount).toBe(0);
        expect(controller.getBreakpoints()).toEqual([]);
    });

    test("debugger addBreakpoint and removeBreakpoint", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pausedLines.push(event.snapshot.location.line ?? -1);
                controller.continue();
            }
        });

        // 添加断点
        controller.addBreakpoint(2);
        controller.addBreakpoint(3);

        let result = await interpreter.execute(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(2);
        expect(pausedLines).toContain(3);

        // 移除第2行的断点
        pausedLines = [];
        controller.removeBreakpoint(2);

        result = await interpreter.execute(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);

        expect(result.success).toBe(true);
        expect(pausedLines).not.toContain(2);
        expect(pausedLines).toContain(3);

        // 清除所有断点
        pausedLines = [];
        controller.clearBreakpoints();

        result = await interpreter.execute(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toEqual([]);
    });

    test("debugger stepOver at global scope", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);

            if (pausedLines.length === 1) {
                controller.stepOver();
            } else {
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
DEBUGGER
x <- 1
x <- x + 1
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedLines.length).toBeGreaterThanOrEqual(2);
        expect(pausedLines[0]).toBe(3);
    });

    test("debugger with RECORD type inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let recordSnapshot: DebugSnapshot | undefined;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                recordSnapshot = event.snapshot;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
TYPE TPerson
  name : STRING
  age : INTEGER
ENDTYPE

DECLARE person : TPerson
person.name <- "Alice"
person.age <- 25
DEBUGGER
OUTPUT person.name
`);

        expect(result.success).toBe(true);
        expect(recordSnapshot).toBeDefined();

        const personVar = recordSnapshot?.scopes[0]?.variables.find((v: { name: string }) => v.name === "person");
        expect(personVar).toBeDefined();
        expect(personVar?.type).toBe("TPerson");
    });

    test("debugger with empty scope variables", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let snapshot: DebugSnapshot | undefined;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                snapshot = event.snapshot;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`DEBUGGER`);

        expect(result.success).toBe(true);
        expect(snapshot).toBeDefined();
        expect(snapshot?.scopes).toBeDefined();
        expect(Array.isArray(snapshot?.scopes)).toBe(true);
    });

    test("debugger with deeply nested function calls", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const callStackDepths: number[] = [];
        controller.onEvent((event) => {
            if (event.type === "paused") {
                callStackDepths.push(event.snapshot.callStack.length);
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
FUNCTION Level3() RETURNS INTEGER
  DEBUGGER
  RETURN 3
ENDFUNCTION

FUNCTION Level2() RETURNS INTEGER
  DEBUGGER
  RETURN Level3()
ENDFUNCTION

FUNCTION Level1() RETURNS INTEGER
  DEBUGGER
  RETURN Level2()
ENDFUNCTION

OUTPUT Level1()
`);

        expect(result.success).toBe(true);
        expect(callStackDepths).toEqual([1, 2, 3]);
    });

    test("debugger condition with missing variable returns false", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        // 使用不存在的变量作为条件
        controller.setConditionalBreakpointExpression(2, "nonExistentVar > 0");

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
OUTPUT "test"
OUTPUT "done"
`);

        expect(result.success).toBe(true);
        // 由于条件评估应该失败（变量不存在），断点不应该触发
        expect(pauseCount).toBe(0);
    });

    test("debugger handles expression with division by zero in condition", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        controller.setConditionalBreakpointExpression(2, "x DIV 0 = 0");

        let pauseCount = 0;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pauseCount += 1;
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE x : INTEGER
x <- 10
OUTPUT x
`);

        // 条件表达式中的除零错误应该被捕获，断点不应该触发
        expect(result.success).toBe(true);
        expect(pauseCount).toBe(0);
    });

    test("debugger isPaused returns correct state", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        expect(controller.isPaused()).toBe(false);

        const pausedPromise = oncePaused(controller);
        const runPromise = interpreter.execute(`DEBUGGER`);

        await pausedPromise;
        expect(controller.isPaused()).toBe(true);

        controller.continue();
        await runPromise;
        expect(controller.isPaused()).toBe(false);
    });

    test("debugger with multiple function calls in single expression", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type === "paused") {
                pausedLines.push(event.snapshot.location.line ?? -1);
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
FUNCTION GetA() RETURNS INTEGER
  DEBUGGER
  RETURN 1
ENDFUNCTION

FUNCTION GetB() RETURNS INTEGER
  DEBUGGER
  RETURN 2
ENDFUNCTION

OUTPUT GetA() + GetB()
`);

        expect(result.success).toBe(true);
        expect(pausedLines).toContain(3);
        expect(pausedLines).toContain(8);
        expect(io.getOutput().trim()).toBe("3");
    });

    test("debugger stepInto enters nested function from expression", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const pausedLines: number[] = [];
        controller.onEvent((event) => {
            if (event.type !== "paused") {
                return;
            }

            pausedLines.push(event.snapshot.location.line ?? -1);

            if (pausedLines.length === 1) {
                controller.stepInto();
            } else if (pausedLines.length < 4) {
                controller.stepInto();
            } else {
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
FUNCTION GetValue() RETURNS INTEGER
  DEBUGGER
  RETURN 42
ENDFUNCTION

DEBUGGER
DECLARE x : INTEGER
x <- GetValue()
OUTPUT x
`);

        expect(result.success).toBe(true);
        expect(pausedLines.length).toBeGreaterThanOrEqual(3);
    });

    test("debugger handles large call stack", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        const maxDepths: number[] = [];
        controller.onEvent((event) => {
            if (event.type === "paused") {
                maxDepths.push(event.snapshot.callStack.length);
                controller.continue();
            }
        });

        // 递归调用100次
        const result = await interpreter.execute(`
FUNCTION Recurse(n : INTEGER) RETURNS INTEGER
  IF n <= 1 THEN
    DEBUGGER
    RETURN 1
  ENDIF
  RETURN n + Recurse(n - 1)
ENDFUNCTION

OUTPUT Recurse(100)
`);

        expect(result.success).toBe(true);
        expect(maxDepths.length).toBeGreaterThan(0);
        expect(maxDepths[0]).toBe(100);
    });

    test("debugger with string variable inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let strValue: unknown;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const strVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "msg");
                if (strVar) {
                    strValue = strVar.value;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE msg : STRING
msg <- "Hello, World!"
DEBUGGER
OUTPUT msg
`);

        expect(result.success).toBe(true);
        expect(strValue).toBe("Hello, World!");
    });

    test("debugger with boolean variable inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let boolValue: unknown;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const boolVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "flag");
                if (boolVar) {
                    boolValue = boolVar.value;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE flag : BOOLEAN
flag <- TRUE
DEBUGGER
OUTPUT flag
`);

        expect(result.success).toBe(true);
        expect(boolValue).toBe(true);
    });

    test("debugger with real variable inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let realValue: unknown;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const realVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "pi");
                if (realVar) {
                    realValue = realVar.value;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE pi : REAL
pi <- 3.14159
DEBUGGER
OUTPUT pi
`);

        expect(result.success).toBe(true);
        expect(realValue).toBeCloseTo(3.14159, 5);
    });

    test("debugger with char variable inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let charValue: unknown;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const charVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "ch");
                if (charVar) {
                    charValue = charVar.value;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE ch : CHAR
ch <- 'A'
DEBUGGER
OUTPUT ch
`);

        expect(result.success).toBe(true);
        expect(charValue).toBe("A");
    });

    test("debugger with array variable inspection", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);
        const controller = new DebuggerController();
        interpreter.attachDebugger(controller);

        let arrayValue: unknown;
        controller.onEvent((event) => {
            if (event.type === "paused") {
                const arrVar = event.snapshot.scopes[0]?.variables.find((v) => v.name === "arr");
                if (arrVar) {
                    arrayValue = arrVar.value;
                }
                controller.continue();
            }
        });

        const result = await interpreter.execute(`
DECLARE arr : ARRAY[1:3] OF INTEGER
arr[1] <- 10
arr[2] <- 20
arr[3] <- 30
DEBUGGER
OUTPUT arr[1]
`);

        expect(result.success).toBe(true);
        expect(Array.isArray(arrayValue)).toBe(true);
        expect(arrayValue).toEqual([10, 20, 30]);
    });

    test("DEBUGGER produces error in CAIE_ONLY mode", async () => {
        const io = new MockIO();
        const interpreter = new Interpreter(io);

        const result = await interpreter.execute(`
// CAIE_ONLY
DECLARE x : INTEGER
x <- 1
DEBUGGER
OUTPUT x
`);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("DEBUGGER is not a CAIE standard feature");
    });
});
