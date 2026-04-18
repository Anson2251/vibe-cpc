import type { CLIInterface, CLIOptions } from "./cli-interface";
import { Interpreter } from "../interpreter";
import type { ExecutionResult, AnalyzeResult } from "../interpreter";
import { QuickJSIOImpl } from "../io/quickjs-io-impl";
import { PseudocodeError } from "../errors";
import * as std from "std";

export class QuickJSCLIAdapter implements CLIInterface {
    private readonly packageName = "vibe-cpc";
    private readonly packageVersion = __VERSION__;

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
                    if (!arg.startsWith("-") && !options.file) {
                        options.file = arg;
                    }
                    break;
            }
        }

        return options;
    }

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
                std.err.puts("Error: Either --file or --code must be specified\n");
                this.showHelp();
                std.exit(1);
            }

            const io = new QuickJSIOImpl();
            const interpreter = new Interpreter(io);

            const sourceCode = options.file ? await io.readFile(options.file) : options.code!;

            if (options.outputFormat === "json") {
                const analyzeResult = interpreter.analyze(sourceCode);
                std.out.puts(this.formatAnalyzeResult(analyzeResult));
            } else {
                const result = options.file
                    ? await interpreter.executeFile(options.file)
                    : await interpreter.execute(options.code!);

                std.out.puts(this.formatResult(result, options.verbose));
            }

            await interpreter.dispose();
            std.exit(0);
        } catch (error) {
            const outputFormat = options.outputFormat || "text";
            this.handleError(
                error instanceof Error ? error : new Error(String(error)),
                outputFormat,
            );
            std.exit(1);
        }
    }

    showHelp(): void {
        std.out.puts(`
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

    showVersion(): void {
        std.out.puts(`${this.packageName} v${this.packageVersion}\n`);
    }

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
                output += "\n";
            }
        }

        if (verbose) {
            if (result.executionTime !== undefined) {
                output += `\nExecution time: ${result.executionTime}ms\n`;
            }

            if (result.steps !== undefined) {
                output += `Execution steps: ${result.steps}\n`;
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

    handleError(error: Error, format: "text" | "json"): void {
        if (format === "json") {
            std.err.puts(
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
            std.err.puts("\n");
        } else {
            std.err.puts(`Error: ${error.message}\n`);
            if (error instanceof PseudocodeError && error.line !== undefined) {
                std.err.puts(
                    `  at line ${error.line}${error.column !== undefined ? `, column ${error.column}` : ""}\n`,
                );
            }
        }
    }
}
