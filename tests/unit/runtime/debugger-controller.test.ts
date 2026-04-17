import { DebuggerController } from "../../../src/runtime/debugger";

describe("DebuggerController condition expression validation", () => {
    test("accepts valid expression", () => {
        const controller = new DebuggerController();
        const result = controller.validateBreakpointConditionExpression(
            "x MOD 2 = 0 AND score >= 40",
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    test("rejects empty condition expression with friendly error", () => {
        const controller = new DebuggerController();
        const result = controller.validateBreakpointConditionExpression("   ");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("cannot be empty");
    });

    test("rejects malformed expression with friendly error", () => {
        const controller = new DebuggerController();
        const result = controller.validateBreakpointConditionExpression("x >");

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid breakpoint condition");
    });

    test("explains missing right parenthesis with specific code", () => {
        const controller = new DebuggerController();
        const details = controller.explainBreakpointConditionError("(x > 1");

        expect(details).not.toBeNull();
        if (details) {
            expect(details.code).toBe("UNEXPECTED_END");
            expect(details.message).toContain("Invalid breakpoint condition");
        }
    });

    test("explains unexpected character with specific code", () => {
        const controller = new DebuggerController();
        const details = controller.explainBreakpointConditionError("x @ 1");

        expect(details).not.toBeNull();
        if (details) {
            expect(details.code).toBe("UNEXPECTED_CHARACTER");
            expect(details.message).toContain("Invalid breakpoint condition");
        }
    });
});
