import { Interpreter } from '../src/interpreter';
import { MockIO } from './mock-io';
import { ExecutionResult } from '../src/interpreter';

export interface TestResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: number;
}

export class TestRunner {
  private mockIO: MockIO;
  private interpreter: Interpreter;

  constructor() {
    this.mockIO = new MockIO();
    this.interpreter = new Interpreter(this.mockIO, {
      debug: false,
      maxExecutionSteps: 1000,
      strictTypeChecking: true
    });
  }

  async runCode(code: string, inputs: string[] = []): Promise<TestResult> {
    this.mockIO.reset();
    this.mockIO.setInput(inputs);

    try {
      const result: ExecutionResult = await this.interpreter.execute(code);

      return {
        success: result.success,
        output: this.mockIO.getOutput(),
        error: result.error?.message,
        executionTime: result.executionTime
      };
    } catch (error) {
      return {
        success: false,
        output: this.mockIO.getOutput(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runFile(filePath: string, inputs: string[] = []): Promise<TestResult> {
    this.mockIO.reset();
    this.mockIO.setInput(inputs);

    try {
      const result: ExecutionResult = await this.interpreter.executeFile(filePath);

      return {
        success: result.success,
        output: this.mockIO.getOutput(),
        error: result.error?.message,
        executionTime: result.executionTime
      };
    } catch (error) {
      return {
        success: false,
        output: this.mockIO.getOutput(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  setFileContent(path: string, content: string): void {
    this.mockIO.setFileContent(path, content);
  }

  getOutputLines(): string[] {
    return this.mockIO.getOutputLines();
  }

  getOutput(): string {
    return this.mockIO.getOutput();
  }

  getWrittenFile(path: string): string | undefined {
    return this.mockIO.getWrittenFile(path);
  }

  setInput(inputs: string[]): void {
    this.mockIO.setInput(inputs);
  }
}

export function expectOutput(result: TestResult, expected: string | string[]): void {
  expect(result.success).toBe(true);

  const actualOutput = result.output.trim();

  if (Array.isArray(expected)) {
    const expectedOutput = expected.join('\n').trim();
    expect(actualOutput).toBe(expectedOutput);
  } else {
    expect(actualOutput).toBe(expected.trim());
  }
}

export function expectLines(result: TestResult, expectedLines: string[]): void {
  expect(result.success).toBe(true);
  const actualLines = result.output.trim().split('\n').filter(line => line.trim() !== '');
  expect(actualLines).toEqual(expectedLines);
}

export function expectError(result: TestResult, expectedError?: string): void {
  expect(result.success).toBe(false);
  if (expectedError) {
    expect(result.error).toContain(expectedError);
  }
}
