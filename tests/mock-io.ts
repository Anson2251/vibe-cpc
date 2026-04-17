/* eslint-disable @typescript-eslint/require-await */
import { IOInterface } from "../src/io/io-interface";

export class MockIO implements IOInterface {
    private outputBuffer: string[] = [];
    private inputBuffer: string[] = [];
    private fileContents: Map<string, string> = new Map();
    private writtenFiles: Map<string, string> = new Map();
    private randomFiles: Map<number, string> = new Map();
    private randomFileRecords: Map<number, Map<number, string>> = new Map();
    private nextFileHandle: number = 1;

    // Input methods
    input(prompt?: string): Promise<string> {
        if (prompt) {
            this.output(prompt);
        }
        if (this.inputBuffer.length === 0) {
            return Promise.resolve("");
        }
        return Promise.resolve(this.inputBuffer.shift() || "");
    }

    output(data: string): void {
        this.outputBuffer.push(data);
    }

    // File methods
    async readFile(path: string): Promise<string> {
        if (this.writtenFiles.has(path)) {
            return this.writtenFiles.get(path)!;
        }
        if (this.fileContents.has(path)) {
            return this.fileContents.get(path)!;
        }
        throw new Error(`File not found: ${path}`);
    }

    async writeFile(path: string, data: string): Promise<void> {
        this.writtenFiles.set(path, data);
        this.fileContents.set(path, data);
    }

    async appendFile(path: string, data: string): Promise<void> {
        const existing = this.writtenFiles.get(path) || this.fileContents.get(path) || "";
        const updated = existing + data;
        this.writtenFiles.set(path, updated);
        this.fileContents.set(path, updated);
    }

    async fileExists(path: string): Promise<boolean> {
        return this.fileContents.has(path) || this.writtenFiles.has(path);
    }

    // Random file operations
    async openRandomFile(path: string): Promise<number> {
        const handle = this.nextFileHandle++;
        this.randomFiles.set(handle, path);
        this.randomFileRecords.set(handle, new Map());
        return handle;
    }

    async readRecord(fileHandle: number, position: number): Promise<string> {
        if (!this.randomFileRecords.has(fileHandle)) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        const records = this.randomFileRecords.get(fileHandle)!;
        if (!records.has(position)) {
            throw new Error(`Invalid record position: ${position}`);
        }
        return records.get(position)!;
    }

    async writeRecord(fileHandle: number, position: number, data: string): Promise<void> {
        if (!this.randomFileRecords.has(fileHandle)) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        this.randomFileRecords.get(fileHandle)!.set(position, data);
    }

    async closeFile(fileHandle: number): Promise<void> {
        this.randomFiles.delete(fileHandle);
        this.randomFileRecords.delete(fileHandle);
    }

    // Error handling
    error(message: string, line?: number, column?: number): void {
        const location =
            line !== undefined
                ? ` at line ${line}${column !== undefined ? `, column ${column}` : ""}`
                : "";
        this.output(`Error: ${message}${location}`);
    }

    // Mock helpers
    setInput(inputs: string[]): void {
        this.inputBuffer = [...inputs];
    }

    getOutput(): string {
        return this.outputBuffer.join("");
    }

    getOutputLines(): string[] {
        return this.outputBuffer
            .join("")
            .split("\n")
            .filter((line) => line.trim() !== "");
    }

    setFileContent(path: string, content: string): void {
        this.fileContents.set(path, content);
    }

    getWrittenFile(path: string): string | undefined {
        return this.writtenFiles.get(path);
    }

    clearOutput(): void {
        this.outputBuffer = [];
    }

    clearInput(): void {
        this.inputBuffer = [];
    }

    clearFiles(): void {
        this.fileContents.clear();
        this.writtenFiles.clear();
        this.randomFiles.clear();
        this.randomFileRecords.clear();
    }

    reset(): void {
        this.clearOutput();
        this.clearInput();
        this.clearFiles();
        this.nextFileHandle = 1;
    }

    dispose(): Promise<void> {
        return Promise.resolve();
    }
}
