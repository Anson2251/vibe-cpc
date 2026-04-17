import { beforeEach, beforeAll, afterAll, vi } from "vitest";

beforeEach(() => {
    vi.clearAllMocks();
});

const mockDate = new Date("2023-01-01T00:00:00.000Z");
const originalDateNow = Date.now;
beforeAll(() => {
    Date.now = vi.fn(() => mockDate.getTime());
});

afterAll(() => {
    Date.now = originalDateNow;
});
