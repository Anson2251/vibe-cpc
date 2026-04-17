/**
 * CLI Interface for CAIE Pseudocode Interpreter
 *
 * This interface defines the contract for all CLI implementations
 * across different JavaScript environments (Node.js, browser, etc.).
 */

import type { ExecutionResult, AnalyzeResult } from "../interpreter";

/**
 * CLI command options
 */
export interface CLIOptions {
    file?: string;
    code?: string;
    verbose?: boolean;
    outputFormat?: "text" | "json";
    version?: boolean;
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
    formatResult(result: ExecutionResult, verbose?: boolean): string;

    formatAnalyzeResult(result: AnalyzeResult): string;

    handleError(error: Error, format: "text" | "json"): void;
}
