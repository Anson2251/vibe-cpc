// Global test setup
import '@jest/globals';

// Silence console output during tests unless explicitly testing output
// const originalConsoleLog = console.log;
// const originalConsoleError = console.error;

beforeEach(() => {
	// Reset console mocks before each test
	jest.clearAllMocks();
});

// afterEach(() => {
// 	// Restore console methods
// 	console.log = originalConsoleLog;
// 	console.error = originalConsoleError;
// });

// Mock Date.now() for consistent timing tests
const mockDate = new Date('2023-01-01T00:00:00.000Z');
const originalDateNow = Date.now;
beforeAll(() => {
	Date.now = jest.fn(() => mockDate.getTime());
});

afterAll(() => {
	Date.now = originalDateNow;
});
