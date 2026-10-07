/**
 * Test setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
process.env.CLERK_SECRET_KEY = 'sk_test_123';
process.env.UPLOADTHING_SECRET = 'sk_test_123';
process.env.UPLOADTHING_APP_ID = 'test_app_id';
process.env.LIVEKIT_API_KEY = 'test_api_key';
process.env.LIVEKIT_API_SECRET = 'test_api_secret';
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';
// NODE_ENV is set to 'test' automatically by Vitest
// process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
