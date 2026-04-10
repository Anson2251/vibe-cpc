import { RuntimeFileManager } from "../../../src/runtime/file-manager";
import { MockIO } from "../../mock-io";

describe("RuntimeFileManager", () => {
    let io: MockIO;
    let manager: RuntimeFileManager;

    beforeEach(() => {
        io = new MockIO();
        manager = new RuntimeFileManager(io);
    });

    test("reads line-by-line and reports EOF", async () => {
        io.setFileContent("input.txt", "A\nB");

        await manager.open("input.txt", "READ");
        expect(manager.isEOF("input.txt")).toBe(false);
        expect(manager.readLine("input.txt")).toBe("A");
        expect(manager.readLine("input.txt")).toBe("B");
        expect(manager.isEOF("input.txt")).toBe(true);
        expect(manager.readLine("input.txt")).toBe("");
    });

    test("writes buffered lines on close in WRITE mode", async () => {
        await manager.open("out.txt", "WRITE");
        manager.writeLine("out.txt", "line1");
        manager.writeLine("out.txt", "line2");
        await manager.close("out.txt");

        expect(io.getWrittenFile("out.txt")).toBe("line1\nline2");
    });

    test("APPEND mode preserves existing content", async () => {
        io.setFileContent("append.txt", "first");

        await manager.open("append.txt", "APPEND");
        manager.writeLine("append.txt", "second");
        await manager.close("append.txt");

        expect(io.getWrittenFile("append.txt")).toBe("first\nsecond");
    });

    test("rejects duplicate open for same file identifier", async () => {
        await manager.open("dup.txt", "WRITE");
        await expect(manager.open("dup.txt", "WRITE")).rejects.toThrow("already open");
    });

    test("rejects invalid RANDOM seek position", async () => {
        await manager.open("records.dat", "RANDOM");
        expect(() => manager.seek("records.dat", -1)).toThrow("Invalid random file position");
        expect(() => manager.seek("records.dat", 1.2)).toThrow("Invalid random file position");
    });
});
