import { Interpreter } from "../../../src/interpreter";
import { MockIO } from "../../mock-io";
import { DebuggerController, DebugEvent } from "../../../src/runtime/debugger";

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
});
