/**
 * CLI Interface for CAIE Pseudocode Interpreter
 * 
 * This interface defines the contract for all CLI implementations
 * across different JavaScript environments (Node.js, browser, etc.).
 */

import { InterpreterOptions, ExecutionResult } from '../interpreter';

/**
 * CLI command options
 */
export interface CLIOptions {
  /** Input file to execute */
  file?: string;
  /** Source code to execute directly */
  code?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Maximum execution steps */
  maxExecutionSteps?: number;
  /** Enable strict type checking */
  strictTypeChecking?: boolean;
  /** Output format (text, json) */
  outputFormat?: 'text' | 'json';
  /** Version flag */
  version?: boolean;
  /** Help flag */
  help?: boolean;
}

/**
 * CLI interface that must be implemented by all environment-specific CLI adapters
 */
export interface CLIInterface {
  /**
   * Parse command line arguments
   * @param args Command line arguments
   * @returns Parsed CLI options
   */
  parseArguments(args: string[]): CLIOptions;

  /**
   * Execute the CLI with the given options
   * @param options CLI options
   * @returns Promise that resolves with the execution result
   */
  execute(options: CLIOptions): Promise<void>;

  /**
   * Show help information
   */
  showHelp(): void;

  /**
   * Show version information
   */
  showVersion(): void;

  /**
   * Format execution result for output
   * @param result Execution result
   * @param format Output format
   * @returns Formatted result string
   */
  formatResult(result: ExecutionResult, format: 'text' | 'json'): string;

  /**
   * Handle errors
   * @param error Error to handle
   * @param format Output format
   */
  handleError(error: Error, format: 'text' | 'json'): void;
}