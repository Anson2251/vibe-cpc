/**
 * CLI Module Entry Point for CAIE Pseudocode Interpreter
 * 
 * This module provides the main entry point for the CLI functionality
 * and exports the necessary components for CLI operations.
 */

// Export the CLI interface
export { CLIInterface, CLIOptions } from './cli-interface';

// Export the Node.js CLI adapter
export { NodeCLIAdapter } from './node-cli-adapter';

// Import for convenience
import { NodeCLIAdapter } from './node-cli-adapter';

/**
 * Create and run the CLI with the given arguments
 * @param args Command line arguments (defaults to process.argv.slice(2))
 */
export async function runCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const cli = new NodeCLIAdapter();
  const options = cli.parseArguments(args);
  await cli.execute(options);
}

/**
 * Main function that can be called directly when this module is run
 */
export async function main(): Promise<void> {
  try {
    await runCLI();
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the CLI if this module is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}