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
});
