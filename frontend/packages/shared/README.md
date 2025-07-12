# @manuel/shared

Shared business logic and platform adapters for Manuel iOS and CLI applications.

## Overview

This package provides a unified interface for both iOS and CLI applications,
abstracting platform-specific functionality behind consistent APIs.

## Architecture

```
src/
├── services/           # API communication and business logic
├── types/             # TypeScript type definitions
├── platform/          # Platform adapter interfaces and implementations
├── utils/             # Shared utility functions
└── index.ts           # Main exports
```

## Key Concepts

### Platform Adapters

Platform adapters abstract platform-specific functionality:

- **StorageAdapter**: Secure storage (expo-secure-store vs filesystem)
- **AudioAdapter**: Audio recording (expo-av vs sox)
- **FileAdapter**: File operations (expo-document-picker vs readline)

```typescript
// Usage example
import { getStorageService } from '@manuel/shared';

const storage = getStorageService();
await storage.setItem('auth_token', token); // Works on both platforms
```

### Services

Business logic services that work consistently across platforms:

- **AuthService**: Authentication and user management
- **QueryService**: Text and voice query processing
- **ManualsService**: Manual upload, download, and management
- **UsageService**: Usage tracking and analytics

```typescript
import { authService, queryService } from '@manuel/shared';

// Sign in user
await authService.login(email, password);

// Make a query
const result = await queryService.textQuery('How do I reset this?');
```

## Platform Detection

The library automatically detects the runtime environment:

```typescript
import { getPlatform } from '@manuel/shared';

const platform = getPlatform(); // 'react-native' | 'node'
```

## Installation

This package is automatically installed when you install dependencies in the
workspace root.

```bash
# From workspace root
yarn install
```

## Building

```bash
npm run build        # Build TypeScript to JavaScript
npm run type-check   # Check TypeScript types
npm run lint         # Lint code
```

## Development

### Adding New Platform Adapters

1. Define the interface in `src/platform/<feature>/base.ts`
2. Implement for React Native in `src/platform/<feature>/react-native.ts`
3. Implement for Node.js in `src/platform/<feature>/node.ts`
4. Export from `src/platform/<feature>/index.ts`

Example:

```typescript
// src/platform/example/base.ts
export interface ExampleAdapter {
  doSomething(): Promise<string>;
}

// src/platform/example/react-native.ts
export class ReactNativeExampleAdapter implements ExampleAdapter {
  async doSomething(): Promise<string> {
    // React Native implementation
  }
}

// src/platform/example/node.ts
export class NodeExampleAdapter implements ExampleAdapter {
  async doSomething(): Promise<string> {
    // Node.js implementation
  }
}
```

### Adding New Services

1. Create service file in `src/services/`
2. Use platform adapters for platform-specific functionality
3. Export from `src/index.ts`

```typescript
// src/services/exampleService.ts
import { getStorageService } from '../platform';

class ExampleService {
  private storage = getStorageService();

  async doSomething() {
    const value = await this.storage.getItem('key');
    // Service logic here
  }
}

export const exampleService = new ExampleService();
```

## Testing

```bash
npm test              # Run all tests
npm test -- --watch  # Run tests in watch mode
```

Tests use Jest and are located alongside source files with `.test.ts` extension.

## API Reference

### Services

#### AuthService

- `login(email, password)` - Authenticate user
- `logout()` - Sign out user
- `signup(email, password, firstName, lastName)` - Create account
- `resetPassword(email)` - Request password reset
- `getUser()` - Get current user info
- `isAuthenticated()` - Check if user is signed in

#### QueryService

- `textQuery(query, options?)` - Submit text query
- `voiceQuery(audioBase64, options?)` - Submit voice query

#### ManualsService

- `getManuals()` - List all manuals
- `getManual(id)` - Get manual details
- `uploadManual(file, name?)` - Upload manual file
- `downloadManual(url, name?)` - Download manual from URL
- `deleteManual(id)` - Delete manual

#### UsageService

- `getUsageStats()` - Get usage statistics
- `getQuotaLimits()` - Get quota information
- `getCostBreakdown(period?)` - Get cost analysis
- `exportUsageData(startDate, endDate, format)` - Export usage data

### Platform Adapters

#### StorageAdapter

- `setItem(key, value)` - Store value
- `getItem(key)` - Retrieve value
- `removeItem(key)` - Remove value
- `clear()` - Clear all data

#### AudioAdapter

- `startRecording(options?)` - Start audio recording
- `stopRecording()` - Stop recording and get result
- `convertToBase64(uri)` - Convert audio to base64

#### FileAdapter

- `pickFile(options?)` - Pick file from device
- `saveFile(data, filename)` - Save file to device

### Utility Functions

- `getPlatform()` - Get current platform ('react-native' | 'node')
- `validateEmail(email)` - Validate email format
- `formatCurrency(amount)` - Format currency amount
- `formatFileSize(bytes)` - Format file size

## Type Definitions

All TypeScript types are exported from the main module:

```typescript
import type {
  User,
  QueryResult,
  Manual,
  UsageStats,
  AuthTokens,
} from '@manuel/shared';
```

## Error Handling

Services throw consistent errors that can be caught and handled:

```typescript
import { AuthError, QueryError, NetworkError } from '@manuel/shared';

try {
  await authService.login(email, password);
} catch (error) {
  if (error instanceof AuthError) {
    // Handle authentication error
  } else if (error instanceof NetworkError) {
    // Handle network error
  }
}
```

## Environment Variables

The package respects these environment variables:

- `MANUEL_API_URL` - Override default API URL
- `NODE_ENV` - Environment mode (development, production)

## License

Same as main Manuel project.
