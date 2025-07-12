# Manuel iOS App

React Native iOS application for querying product manuals using voice and text.

## Features

- **Authentication**: Secure login, signup, and password reset
- **Voice Queries**: Record questions and get instant answers
- **Text Queries**: Type questions with rich formatting
- **Manual Management**: Upload, view, and organize product manuals
- **Usage Tracking**: Monitor quotas, costs, and query history
- **Native iOS Design**: Follows iOS Human Interface Guidelines

## Prerequisites

- Node.js 18+
- Yarn or npm
- Xcode 14+
- iOS Simulator or physical iOS device
- Expo CLI (`npm install -g @expo/cli`)

## Installation

```bash
# From the ios-app directory
cd packages/ios-app
npm install

# Or from workspace root
yarn install
```

## Development

### Starting the Development Server

```bash
expo start
```

This will start the Expo development server. You can then:

- Press `i` to open iOS Simulator
- Scan QR code with Expo Go app on physical device
- Open in Xcode for advanced debugging

### Building for Device

```bash
# Development build
expo build:ios --type simulator

# Production build
expo build:ios --type archive
```

### Running on Physical Device

1. Install Expo Go from the App Store
2. Run `expo start`
3. Scan the QR code with your device's camera
4. The app will open in Expo Go

## Project Structure

```
src/
├── components/        # Reusable UI components
├── screens/          # Screen components
│   ├── auth/         # Authentication screens
│   └── main/         # Main app screens
├── navigation/       # Navigation configuration
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── App.tsx          # Root component
```

## Key Screens

### Authentication Flow

- **WelcomeScreen**: App introduction and entry point
- **LoginScreen**: User sign-in with email/password
- **SignupScreen**: Account creation with validation
- **ForgotPasswordScreen**: Password reset flow

### Main Application

- **HomeScreen**: Dashboard with quick actions and usage stats
- **QueryScreen**: Text-based question interface
- **VoiceQueryScreen**: Voice recording and processing
- **ManualsScreen**: Manual library management
- **ManualDetailScreen**: Individual manual information
- **SettingsScreen**: App preferences and account management
- **UsageScreen**: Detailed usage analytics

## Navigation Structure

```
Root Navigator
├── Auth Stack (when not authenticated)
│   ├── Welcome
│   ├── Login
│   ├── Signup
│   └── Forgot Password
└── Main Stack (when authenticated)
    ├── Tab Navigator
    │   ├── Home
    │   ├── Query
    │   ├── Manuals
    │   └── Settings
    ├── Voice Query (Modal)
    ├── Manual Detail
    └── Usage
```

## Features in Detail

### Voice Queries

- **Recording**: Uses expo-av for high-quality audio capture
- **Real-time Feedback**: Visual recording indicator with timer
- **Processing**: Automatic transcription and AI processing
- **Results**: Formatted answers with source references

### Text Queries

- **Rich Input**: Multi-line text input with character counter
- **Options**: Include/exclude source references
- **Results**: Formatted responses with cost tracking
- **History**: Access to previous queries

### Manual Management

- **Upload**: File picker integration for PDF uploads
- **Status Tracking**: Real-time processing status
- **Details**: File size, page count, upload date
- **Actions**: View, query, delete operations

### Usage Analytics

- **Real-time Stats**: Daily and monthly usage tracking
- **Cost Monitoring**: Detailed cost breakdown by operation
- **Progress Indicators**: Visual quota usage displays
- **Recent Activity**: History of recent queries

## Shared Library Integration

The iOS app uses `@manuel/shared` for:

- **API Communication**: All backend interactions
- **Authentication State**: Centralized auth management
- **Platform Adapters**: iOS-specific implementations
- **Type Safety**: Shared TypeScript definitions

```typescript
import { useAuth, queryService } from '@manuel/shared';

const { user, login, logout } = useAuth();
const result = await queryService.textQuery(question);
```

## Platform Adapters

iOS-specific implementations:

- **Storage**: Uses expo-secure-store for token storage
- **Audio**: Uses expo-av for recording capabilities
- **Files**: Uses expo-document-picker for file selection

## State Management

- **React Context**: For authentication state
- **React Hooks**: For local component state
- **Shared Services**: For business logic and API calls

## Styling and Design

- **Native iOS Components**: Uses React Native built-in components
- **iOS Design System**: Follows Apple's design guidelines
- **Dynamic Colors**: Supports light/dark mode
- **Safe Areas**: Proper handling of notches and home indicator
- **Accessibility**: VoiceOver support and semantic labels

## Performance Optimizations

- **Lazy Loading**: Screens loaded on demand
- **Image Optimization**: Automatic image compression
- **Memory Management**: Proper cleanup of audio recordings
- **Navigation**: Efficient screen transitions

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run type checking
npm run type-check
```

## Building for Production

### TestFlight Distribution

1. **Build**: `expo build:ios --type archive`
2. **Download**: Download .ipa file from Expo
3. **Upload**: Use Application Loader or Xcode to upload to App Store Connect
4. **TestFlight**: Distribute to beta testers

### App Store Release

1. **Complete TestFlight testing**
2. **Submit for review** in App Store Connect
3. **Monitor review status**
4. **Release when approved**

## Configuration

### Environment Variables

Set in `app.config.js`:

```javascript
export default {
  expo: {
    extra: {
      apiUrl: process.env.MANUEL_API_URL || 'https://api.manuel.ai',
      environment: process.env.NODE_ENV || 'development',
    },
  },
};
```

Access in app:

```typescript
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

### App Configuration

Key settings in `app.config.js`:

- Bundle identifier
- App name and description
- Icon and splash screen
- Permissions (microphone, file access)
- iOS-specific settings

## Troubleshooting

### Common Issues

**Metro bundler fails to start**

```bash
expo start -c  # Clear cache
```

**Audio recording not working**

- Check microphone permissions in iOS Settings
- Ensure physical device (simulator doesn't support microphone)

**Build failures**

- Check Xcode version compatibility
- Clear node_modules and reinstall
- Update Expo CLI to latest version

**Authentication issues**

- Check network connectivity
- Verify API endpoint configuration
- Check device time/date settings

### Debug Mode

Enable debug mode in development:

- Shake device or Cmd+D in simulator
- Access developer menu
- Enable debugging options

## Contributing

1. Follow React Native and iOS development best practices
2. Use TypeScript for all new code
3. Follow existing component patterns
4. Test on both simulator and physical device
5. Ensure accessibility compliance
6. Update documentation for new features

## License

Same as main Manuel project.
