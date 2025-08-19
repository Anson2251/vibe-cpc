/**
 * CAIE Pseudocode Interpreter - Main Interpreter Class
 * 
 * This module implements the main interpreter class that coordinates
 * the lexer, parser, and evaluator to execute pseudocode programs.
 */

import { Lexer } from './lexer/lexer';
import { Parser } from './parser/parser';
import { Evaluator } from './runtime/evaluator';
import { Environment, ExecutionContext } from './runtime/environment';
import { IOInterface } from './io/io-interface';
import { ProgramNode } from './parser/ast-nodes';
import { PseudocodeError, ErrorHandler } from './errors';

/**
 * Interpreter options
 */
export interface InterpreterOptions {
  debug?: boolean;
  maxExecutionSteps?: number;
  strictTypeChecking?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: PseudocodeError;
  executionTime?: number;
  steps?: number;
}

/**
 * Main interpreter class for CAIE pseudocode
 */
export class Interpreter {
  private io: IOInterface;
  private options: InterpreterOptions;
  private errorHandler: ErrorHandler;
  private executionSteps: number = 0;

  constructor(io: IOInterface, options: InterpreterOptions = {}) {
    this.io = io;
    this.options = {
      debug: false,
      maxExecutionSteps: 10000,
      strictTypeChecking: true,
      ...options
    };
    this.errorHandler = new ErrorHandler(io);
  }

  /**
   * Execute a pseudocode program from source code
   */
  async execute(sourceCode: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.executionSteps = 0;

    sourceCode = sourceCode
        .trim()
        .split('\n')
        .filter(line => line.trim().startsWith('//') === false && !!line.trim())
        .join('\n');

    try {
      // Step 1: Lexical analysis
      if (this.options.debug) {
        this.io.output("Lexical analysis...\n");
      }
      
      const lexer = new Lexer(sourceCode);
      const tokens = lexer.tokenize();
      
      if (this.options.debug) {
        this.io.output(`Tokens: ${tokens.length}\n`);
        this.io.output(`Tokens: \n${tokens.map(token => token.toString()).join('\n')}\n`);
      }

      // Step 2: Parsing
      if (this.options.debug) {
        this.io.output("Parsing...\n");
      }
      
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      if (this.options.debug) {
        this.io.output(`AST: ${JSON.stringify(ast, null, 2)}\n`);
      }

      // Step 3: Evaluation
      if (this.options.debug) {
        this.io.output("Evaluating...\n");
      }
      
      const environment = new Environment();
      const context = new ExecutionContext(environment);
      const evaluator = new Evaluator(this.io);
      
      // Override the evaluator's context with our own
      (evaluator as any).context = context;
      
      const result = await evaluator.evaluateProgram(ast);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      return {
        success: true,
        output: result !== undefined ? String(result) : undefined,
        executionTime,
        steps: this.executionSteps
      };
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      let pseudocodeError: PseudocodeError;
      
      if (error instanceof PseudocodeError) {
        pseudocodeError = error;
      } else {
        // Convert generic errors to PseudocodeError
        pseudocodeError = new PseudocodeError(
          error instanceof Error ? error.message : String(error)
        );
      }
      
      // Report the error
      this.errorHandler.error(
        pseudocodeError.message,
        pseudocodeError.line,
        pseudocodeError.column
      );
      
      return {
        success: false,
        error: pseudocodeError,
        executionTime,
        steps: this.executionSteps
      };
    }
  }

  /**
   * Execute a pseudocode program from a file
   */
  async executeFile(filePath: string): Promise<ExecutionResult> {
    try {
      const sourceCode = await this.io.readFile(filePath);
      return await this.execute(sourceCode);
    } catch (error) {
      const endTime = Date.now();
      
      let pseudocodeError: PseudocodeError;
      
      if (error instanceof PseudocodeError) {
        pseudocodeError = error;
      } else {
        // Convert generic errors to PseudocodeError
        pseudocodeError = new PseudocodeError(
          error instanceof Error ? error.message : String(error)
        );
      }
      
      // Report the error
      this.errorHandler.error(
        pseudocodeError.message,
        pseudocodeError.line,
        pseudocodeError.column
      );
      
      return {
        success: false,
        error: pseudocodeError,
        executionTime: endTime - Date.now(),
        steps: this.executionSteps
      };
    }
  }

  /**
   * Parse source code into an AST without executing it
   */
  parse(sourceCode: string): ProgramNode {
    try {
      const lexer = new Lexer(sourceCode);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      return parser.parse();
    } catch (error) {
      if (error instanceof PseudocodeError) {
        throw error;
      }
      
      throw new PseudocodeError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get the current execution step count
   */
  getExecutionSteps(): number {
    return this.executionSteps;
  }

  /**
   * Reset the execution step counter
   */
  resetExecutionSteps(): void {
    this.executionSteps = 0;
  }

  /**
   * Increment the execution step counter and check if we've exceeded the maximum
   */
  incrementExecutionSteps(): void {
    this.executionSteps++;
    
    if (
      this.options.maxExecutionSteps !== undefined &&
      this.executionSteps > this.options.maxExecutionSteps
    ) {
      throw new PseudocodeError(
        `Maximum execution steps (${this.options.maxExecutionSteps}) exceeded`
      );
    }
  }

  /**
   * Set interpreter options
   */
  setOptions(options: Partial<InterpreterOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current interpreter options
   */
  getOptions(): InterpreterOptions {
    return { ...this.options };
  }

  /**
   * Dispose of resources used by the interpreter
   */
  dispose(): void {
    // Clean up any resources
    if (this.io && typeof (this.io as any).dispose === 'function') {
      (this.io as any).dispose();
    }
  }
}