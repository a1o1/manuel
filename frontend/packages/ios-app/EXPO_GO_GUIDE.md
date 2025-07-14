# Expo Go Connection Guide

## Current Issue: Node.js Module Conflicts

The app is trying to import Node.js modules (`fs/promises`) which aren't
available in React Native. Here's how to fix it:

## Quick Fix Options:

### Option 1: Use Pure Mock Mode (Recommended)

1. Stop all Metro processes:

   ```bash
   pkill -f "expo start"
   ```

2. Temporarily remove real services:

   ```bash
   mv src/services/real src/services/real_disabled
   ```

3. Update service factory to only use mocks:

   ```bash
   # Edit src/services/index.ts to only import mock services
   ```

4. Restart Metro:
   ```bash
   npx expo start --clear
   ```

### Option 2: Fix Import Issues

The real services are importing `@manuel/shared` which has Node.js dependencies.
We need to:

1. Remove all `@manuel/shared` imports from `src/services/real/*.ts`
2. Replace with stub implementations
3. Ensure mock mode is enabled in `src/config/environment.ts`

## Connection Steps Once Fixed:

1. **Start Metro**: `npx expo start --localhost`
2. **Open Expo Go** on iPhone simulator
3. **Enter URL**: `exp://localhost:8081`
4. **OR press 'i'** in terminal when Metro is ready

## Expected Result:

- Manuel app loads with mock login screen
- Can test navigation, UI components
- Voice recording interface available
- All features work with mock data

## If Still Having Issues:

Try the tunnel mode:

```bash
npm install -g @expo/ngrok
npx expo start --tunnel
```

Then scan QR code or use the tunnel URL in Expo Go.
