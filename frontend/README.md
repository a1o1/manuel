# Manuel Frontend - Dual Platform Architecture

This frontend consists of two applications that share a common core library:

- **iOS App**: React Native application for iPhone
- **CLI App**: Node.js command-line application for macOS terminal

## Architecture Overview

```
frontend/
├── packages/
│   ├── shared/          # Shared business logic and platform adapters
│   ├── ios-app/         # React Native iOS application with mock services
│   └── cli-app/         # Node.js CLI application
├── package.json         # Workspace configuration
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Yarn (recommended) or npm
- For iOS: Xcode, iOS Simulator, Expo CLI
- For CLI: Terminal (macOS/Linux)

### Installation

```bash
# Install dependencies for all packages
yarn install

# Or with npm
npm install
```

### Running the Applications

#### iOS App

```bash
cd packages/ios-app
expo start
```

#### CLI App

```bash
cd packages/cli-app
npm run build
npm link

# Now you can use 'manuel' command anywhere
manuel --help
manuel auth login
manuel query "How do I reset my router?"
```

## Package Structure

### @manuel/shared

The core shared library containing:

- **Services**: API communication, authentication, usage tracking
- **Types**: TypeScript definitions shared across platforms
- **Platform Adapters**: Abstraction layer for platform-specific functionality
  - Storage (SecureStore vs Filesystem)
  - Audio (expo-av vs sox)
  - File handling (DocumentPicker vs readline)

### @manuel/ios-app

React Native application featuring:

- **Authentication**: Login, signup, password reset
- **Voice & Text Queries**: Interactive Q&A with manuals
- **Manual Management**: Upload, view, delete manuals
- **Usage Tracking**: Monitor quotas and costs
- **Native iOS Design**: Following iOS Human Interface Guidelines
- **Development Tools**: Environment switcher and mock user testing
- **User Isolation Testing**: Mock services for testing user data separation

### @manuel/cli-app

Node.js CLI application featuring:

- **Full Authentication Flow**: Login, signup, password management
- **Interactive Mode**: Terminal-based UI for all operations
- **Voice Queries**: Record audio using sox, process with backend
- **Manual Management**: Upload, download, list, delete manuals
- **Usage Analytics**: Detailed usage statistics and export
- **Configuration Management**: Persistent settings

## Development

### Building

```bash
# Build shared library
cd packages/shared
npm run build

# Build CLI app
cd packages/cli-app
npm run build

# iOS app builds are handled by Expo
```

### Testing

```bash
# Test shared library
cd packages/shared
npm test

# Test CLI app
cd packages/cli-app
npm test

# iOS app testing with Expo
cd packages/ios-app
npm test
```

### Adding Dependencies

```bash
# Add to shared library
cd packages/shared
yarn add <package>

# Add to specific app
cd packages/ios-app  # or cli-app
yarn add <package>

# Add workspace-wide dev dependency
yarn add -W -D <package>
```

## Platform Adapter Pattern

The shared library uses platform adapters to abstract platform-specific
functionality:

```typescript
// Example: Storage adapter
const storageService = getStorageService();
await storageService.setItem('key', 'value'); // SecureStore on iOS, fs on CLI
```

Available adapters:

- **StorageAdapter**: Secure storage abstraction
- **AudioAdapter**: Audio recording abstraction
- **FileAdapter**: File handling abstraction

## Development & Testing Features

### Mock Services (iOS App)

The iOS app includes comprehensive mock services for development and testing:

- **User Context Simulation**: Switch between different mock users
- **User-Scoped Data**: Each mock user has different manuals and usage data
- **Environment Switcher**: Toggle between mock and production modes
- **Development Indicators**: Visual indicators for development mode

#### Mock Users

- **John Doe (user1)**: Has Router and TV manuals
- **Jane Smith (user2)**: Has Coffee Machine manual
- **Mike Johnson (user3)**: No manuals (empty state testing)

#### Environment Switching

```typescript
// Access environment switcher in development builds
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher';

// Toggle between mock and production services
switchToMock(); // Use mock services
switchToProduction(); // Use real API services
```

### User Isolation Testing

The mock services demonstrate user data isolation by:

- Maintaining separate data stores per user
- Simulating user-scoped API responses
- Testing user switching without backend changes
- Validating UI behavior with different data scenarios

## Key Features

### iOS App

- Native iOS navigation and design
- Voice recording with expo-av
- Secure storage with expo-secure-store
- File picking with expo-document-picker
- Optimized for touch interaction

### CLI App

- Rich terminal interface with inquirer
- Voice recording with sox
- Filesystem-based storage
- Interactive and command-line modes
- Optimized for keyboard interaction

### Shared Library

- Unified API communication
- Consistent authentication flow
- Common business logic
- Type-safe TypeScript throughout
- Platform-agnostic service layer

## Configuration

### iOS App

Configuration is handled through the shared settings service and React Native
configuration.

### CLI App

```bash
manuel config show                    # View current config
manuel config set apiUrl <url>        # Set API endpoint
manuel config interactive             # Interactive setup
```

## Commands (CLI App)

### Authentication

```bash
manuel auth login                     # Sign in
manuel auth signup                    # Create account
manuel auth logout                    # Sign out
manuel auth status                    # Check auth status
```

### Queries

```bash
manuel query "How do I reset this?"  # Text query
manuel query --voice                 # Voice query
manuel query --interactive           # Chat mode
```

### Manual Management

```bash
manuel manuals list                   # List all manuals
manuel manuals upload <file>          # Upload manual
manuel manuals download <url>         # Download from URL
manuel manuals delete <id>            # Delete manual
manuel manuals interactive            # Interactive management
```

### Usage & Analytics

```bash
manuel usage overview                 # Usage statistics
manuel usage today                    # Today's usage
manuel usage quotas                   # Quota limits
manuel usage costs                    # Cost breakdown
manuel usage export --format csv     # Export usage data
```

### Interactive Mode

```bash
manuel                               # Start interactive mode
```

## Development Tips

1. **Shared First**: Add common functionality to `@manuel/shared` first
2. **Platform Adapters**: Use adapters for platform-specific code
3. **Type Safety**: Leverage TypeScript throughout
4. **Testing**: Test shared logic thoroughly, platform-specific code separately
5. **Build Order**: Always build shared library before apps

## Troubleshooting

### iOS App

- Ensure Expo CLI is installed: `npm install -g @expo/cli`
- Clear cache: `expo start -c`
- Check iOS Simulator is available

### CLI App

- Build shared library first: `cd packages/shared && npm run build`
- Link CLI globally: `npm link` in `packages/cli-app`
- Check Node.js version: requires 18+

### Shared Library

- Type errors: Run `npm run type-check`
- Build issues: Clear `dist/` folder and rebuild

## Contributing

1. Make changes to shared library first when possible
2. Update both iOS and CLI apps to use new shared functionality
3. Test on both platforms
4. Update documentation
5. Follow existing code patterns and TypeScript conventions

## License

Same as main Manuel project.
