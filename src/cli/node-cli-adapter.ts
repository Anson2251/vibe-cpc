/**
 * Node.js CLI Adapter for CAIE Pseudocode Interpreter
 *
 * This class implements the CLIInterface for Node.js environments,
 * providing command-line argument parsing and execution capabilities.
 */

import type { CLIInterface, CLIOptions } from "./cli-interface";
import { Interpreter } from "../interpreter";
import type { ExecutionResult, AnalyzeResult } from "../interpreter";
import { NodeIOImpl } from "../io/node-io-impl";
import { PseudocodeError } from "../errors";

/**
 * Node.js implementation of the CLI interface
 */
export class NodeCLIAdapter implements CLIInterface {
    private readonly packageName = "vibe-cpc";
    private readonly packageVersion = __VERSION__;

    /**
     * Parse command line arguments
     * @param args Command line arguments (typically process.argv.slice(2))
     * @returns Parsed CLI options
     */
    parseArguments(args: string[]): CLIOptions {
        const options: CLIOptions = {};

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            switch (arg) {
                case "-f":
                case "--file":
                    if (i + 1 < args.length) {
                        options.file = args[++i];
                    }
                    break;

                case "-c":
                case "--code":
                    if (i + 1 < args.length) {
                        options.code = args[++i];
                    }
                    break;

                case "--verbose":
                    options.verbose = true;
                    break;

                case "-o":
                case "--output":
                    if (i + 1 < args.length) {
                        const format = args[++i];
                        if (format === "text" || format === "json") {
                            options.outputFormat = format;
                        }
                    }
                    break;

                case "-v":
                case "--version":
                    options.version = true;
                    break;

                case "-h":
                case "--help":
                    options.help = true;
                    break;

                default:
                    // If it's not a flag, treat it as a file path
                    if (!arg.startsWith("-") && !options.file) {
                        options.file = arg;
                    }
                    break;
            }
        }

        return options;
    }

    /**
     * Execute the CLI with the given options
     * @param options CLI options
     */
    async execute(options: CLIOptions): Promise<void> {
        try {
            if (options.version) {
                this.showVersion();
                return;
            }

            if (options.help) {
                this.showHelp();
                return;
            }

            if (!options.file && !options.code) {
                console.error("Error: Either --file or --code must be specified");
                this.showHelp();
                process.exit(1);
            }

            const io = new NodeIOImpl();
            const interpreter = new Interpreter(io);

            const sourceCode = options.file ? await io.readFile(options.file) : options.code!;

            if (options.outputFormat === "json") {
                const analyzeResult = interpreter.analyze(sourceCode);
                console.log(this.formatAnalyzeResult(analyzeResult));
            } else {
                const result = options.file
                    ? await interpreter.executeFile(options.file)
                    : await interpreter.execute(options.code!);

                const formattedResult = this.formatResult(result, options.verbose);
                if (formattedResult) {
                    console.log(formattedResult);
                }
            }

            await interpreter.dispose();
            process.exit(0);
        } catch (error) {
            const outputFormat = options.outputFormat || "text";
            this.handleError(
                error instanceof Error ? error : new Error(String(error)),
                outputFormat,
            );
            process.exit(1);
        }
    }

    /**
     * Show help information
     */
    showHelp(): void {
        console.log(`
${this.packageName} v${this.packageVersion}

A TypeScript interpreter for the CAIE pseudocode language

USAGE:
  vibe-cpc [OPTIONS] [FILE]
  vibe-cpc [OPTIONS] --code CODE

OPTIONS:
  -f, --file FILE          Execute pseudocode from FILE
  -c, --code CODE          Execute pseudocode from CODE string
      --verbose            Show execution time and steps
  -o, --output FORMAT      Output format: text (execute) or json (tokens & AST)
  -v, --version            Show version information
  -h, --help               Show this help message

EXAMPLES:
  vibe-cpc program.pseudo
  vibe-cpc --code "DECLARE x : INTEGER\\nx <- 5\\nOUTPUT x"
  vibe-cpc --file program.pseudo --verbose
  vibe-cpc --file program.pseudo --output json
`);
    }

    /**
     * Show version information
     */
    showVersion(): void {
        console.log(`${this.packageName} v${this.packageVersion}`);
    }

    /**
     * Format execution result for output
     * @param result Execution result
     * @param format Output format
     * @returns Formatted result string
     */
    formatResult(result: ExecutionResult, verbose?: boolean): string {
        let output = "";

        if (!result.success) {
            if (result.error) {
                output += `Error: ${result.error.message}`;
                if (result.error.line !== undefined) {
                    output += ` at line ${result.error.line}`;
                    if (result.error.column !== undefined) {
                        output += `, column ${result.error.column}`;
                    }
                }
            }
        }

        if (verbose) {
            if (result.executionTime !== undefined) {
                output += `\nExecution time: ${result.executionTime}ms`;
            }

            if (result.steps !== undefined) {
                output += `\nExecution steps: ${result.steps}`;
            }
        }

        return output;
    }

    formatAnalyzeResult(result: AnalyzeResult): string {
        return JSON.stringify(
            {
                success: result.success,
                tokens: result.tokens,
                ast: result.ast,
                error: result.error
                    ? {
                          message: result.error.message,
                          line: result.error.line,
                          column: result.error.column,
                      }
                    : undefined,
            },
            null,
            2,
        );
    }

    /**
     * Handle errors
     * @param error Error to handle
     * @param format Output format
     */
    handleError(error: Error, format: "text" | "json"): void {
        if (format === "json") {
            console.error(
                JSON.stringify(
                    {
                        success: false,
                        error: {
                            message: error.message,
                            name: error.name,
                            stack: error.stack,
                        },
                    },
                    null,
                    2,
                ),
            );
        } else {
            console.error(`Error: ${error.message}`);
            if (error instanceof PseudocodeError && error.line !== undefined) {
                console.error(
                    `  at line ${error.line}${error.column !== undefined ? `, column ${error.column}` : ""}`,
                );
            }
        }
    }
}
