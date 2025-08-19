/**
 * Node.js CLI Adapter for CAIE Pseudocode Interpreter
 * 
 * This class implements the CLIInterface for Node.js environments,
 * providing command-line argument parsing and execution capabilities.
 */

import { CLIInterface, CLIOptions } from './cli-interface';
import { Interpreter, InterpreterOptions, ExecutionResult } from '../interpreter';
import { NodeIOImpl } from '../io/node-io-impl';
import { PseudocodeError } from '../errors';
import { readFileSync } from 'fs';

/**
 * Node.js implementation of the CLI interface
 */
export class NodeCLIAdapter implements CLIInterface {
  private readonly packageName = 'caie-pseudocode-interpreter';
  private readonly packageVersion = '1.0.0';

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
        case '-f':
        case '--file':
          if (i + 1 < args.length) {
            options.file = args[++i];
          }
          break;
          
        case '-c':
        case '--code':
          if (i + 1 < args.length) {
            options.code = args[++i];
          }
          break;
          
        case '-d':
        case '--debug':
          options.debug = true;
          break;
          
        case '-m':
        case '--max-steps':
          if (i + 1 < args.length) {
            options.maxExecutionSteps = parseInt(args[++i], 10);
          }
          break;
          
        case '-s':
        case '--strict':
          options.strictTypeChecking = true;
          break;
          
        case '-o':
        case '--output':
          if (i + 1 < args.length) {
            const format = args[++i];
            if (format === 'text' || format === 'json') {
              options.outputFormat = format;
            }
          }
          break;
          
        case '-v':
        case '--version':
          options.version = true;
          break;
          
        case '-h':
        case '--help':
          options.help = true;
          break;
          
        default:
          // If it's not a flag, treat it as a file path
          if (!arg.startsWith('-') && !options.file) {
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
      // Handle version flag
      if (options.version) {
        this.showVersion();
        return;
      }
      
      // Handle help flag
      if (options.help) {
        this.showHelp();
        return;
      }
      
      // Validate that we have either a file or code
      if (!options.file && !options.code) {
        console.error('Error: Either --file or --code must be specified');
        this.showHelp();
        process.exit(1);
      }
      
      // Create interpreter options
      const interpreterOptions: InterpreterOptions = {
        debug: options.debug,
        maxExecutionSteps: options.maxExecutionSteps,
        strictTypeChecking: options.strictTypeChecking
      };
      
      // Create interpreter with Node.js IO implementation
      const io = new NodeIOImpl();
      const interpreter = new Interpreter(io, interpreterOptions);
      
      let result: ExecutionResult;
      
      // Execute file or code
      if (options.file) {
        result = await interpreter.executeFile(options.file);
      } else {
        result = await interpreter.execute(options.code!);
      }
      
      // Format and output the result
      const outputFormat = options.outputFormat || 'text';
      const formattedResult = this.formatResult(result, outputFormat);
      console.log(formattedResult);
      
      // Clean up
      interpreter.dispose();
      
      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);
      
    } catch (error) {
      const outputFormat = options.outputFormat || 'text';
      this.handleError(error instanceof Error ? error : new Error(String(error)), outputFormat);
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
  caie-pseudocode [OPTIONS] [FILE]
  caie-pseudocode [OPTIONS] --code CODE

OPTIONS:
  -f, --file FILE          Execute pseudocode from FILE
  -c, --code CODE          Execute pseudocode from CODE string
  -d, --debug              Enable debug mode
  -m, --max-steps NUMBER   Set maximum execution steps (default: 10000)
  -s, --strict             Enable strict type checking
  -o, --output FORMAT      Set output format (text|json) (default: text)
  -v, --version            Show version information
  -h, --help               Show this help message

EXAMPLES:
  caie-pseudocode program.pseudo
  caie-pseudocode --file program.pseudo --debug
  caie-pseudocode --code "DECLARE x : INTEGER\\nx <- 5\\nOUTPUT x"
  caie-pseudocode --file program.pseudo --output json
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
  formatResult(result: ExecutionResult, format: 'text' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        success: result.success,
        output: result.output,
        error: result.error ? {
          message: result.error.message,
          line: result.error.line,
          column: result.error.column
        } : undefined,
        executionTime: result.executionTime,
        steps: result.steps
      }, null, 2);
    }
    
    // Text format
    let output = '';
    
    if (result.success) {
      output += '\n\n';
      if (result.output) {
        output += `Output: ${result.output}\n`;
      }
    } else {
      output += 'Execution failed\n';
      if (result.error) {
        output += `Error: ${result.error.message}`;
        if (result.error.line !== undefined) {
          output += ` at line ${result.error.line}`;
          if (result.error.column !== undefined) {
            output += `, column ${result.error.column}`;
          }
        }
        output += '\n';
      }
    }
    
    if (result.executionTime !== undefined) {
      output += `Execution time: ${result.executionTime}ms\n`;
    }
    
    if (result.steps !== undefined) {
      output += `Execution steps: ${result.steps}\n`;
    }
    
    return output;
  }

  /**
   * Handle errors
   * @param error Error to handle
   * @param format Output format
   */
  handleError(error: Error, format: 'text' | 'json'): void {
    if (format === 'json') {
      console.error(JSON.stringify({
        success: false,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        }
      }, null, 2));
    } else {
      console.error(`Error: ${error.message}`);
      if (error instanceof PseudocodeError && error.line !== undefined) {
        console.error(`  at line ${error.line}${error.column !== undefined ? `, column ${error.column}` : ''}`);
      }
    }
  }
}