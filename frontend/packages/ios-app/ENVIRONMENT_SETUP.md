# Environment-Based Service Architecture

This setup allows you to easily switch between mock services (for development)
and real backend services (for production).

## 🔧 Quick Setup

### Development Mode (Default)

```typescript
// In src/config/environment.ts
ENV_CONFIG.MODE = 'mock'; // Uses mock services
```

### Production Mode

```typescript
// In src/config/environment.ts
ENV_CONFIG.MODE = 'production'; // Uses real backend
ENV_CONFIG.API_BASE_URL = 'https://your-api-gateway-url.com/dev';
```

## 📁 Architecture

```
src/
├── config/
│   └── environment.ts           # Environment configuration
├── services/
│   ├── index.ts                 # Service factory & interfaces
│   ├── mock/                    # Mock implementations
│   │   ├── authService.ts
│   │   ├── usageService.ts
│   │   ├── queryService.ts
│   │   └── manualsService.ts
│   └── real/                    # Real backend implementations
│       ├── authService.ts       # (Create when backend ready)
│       ├── usageService.ts      # (Create when backend ready)
│       ├── queryService.ts      # (Create when backend ready)
│       └── manualsService.ts    # (Create when backend ready)
└── contexts/
    └── AppContext.tsx           # Unified app context
```

## 🚀 How It Works

### 1. Service Interfaces

All services implement consistent interfaces:

```typescript
interface AuthService {
  login(email: string, password: string): Promise<{ user: any; token: string }>;
  // ... other methods
}
```

### 2. Service Factory

The factory chooses implementation based on environment:

```typescript
export const createAuthService = (): AuthService => {
  if (ENV_CONFIG.FEATURES.MOCK_AUTH) {
    return new MockAuthService();
  }
  return new RealAuthService(); // When ready
};
```

### 3. App Context

Unified context uses service instances:

```typescript
// In AppContext.tsx
import { authService, usageService } from '../services';
```

## 🔄 Switching Modes

### Method 1: Environment Config

```typescript
// For development
switchToMock();

// For production
switchToProduction();
```

### Method 2: Feature Flags

```typescript
ENV_CONFIG.FEATURES.MOCK_AUTH = false; // Use real auth
ENV_CONFIG.FEATURES.MOCK_QUERIES = true; // Keep mock queries
```

### Method 3: Manual Toggle

```typescript
ENV_CONFIG.MODE = 'production';
ENV_CONFIG.API_BASE_URL = 'https://your-api.com';
```

## 📝 Adding Real Services

When your backend is ready:

### 1. Create Real Service Implementation

```typescript
// src/services/real/authService.ts
export class RealAuthService implements AuthService {
  async login(email: string, password: string) {
    const response = await fetch(`${getApiUrl('/auth/login')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }
}
```

### 2. Update Service Factory

```typescript
// src/services/index.ts
import { RealAuthService } from './real/authService';

export const createAuthService = (): AuthService => {
  if (ENV_CONFIG.FEATURES.MOCK_AUTH) {
    return new MockAuthService();
  }
  return new RealAuthService(); // ✅ Now implemented
};
```

### 3. Switch Environment

```typescript
ENV_CONFIG.MODE = 'production';
ENV_CONFIG.FEATURES.MOCK_AUTH = false;
```

## 🧪 Testing Both Modes

Your app context usage remains identical:

```typescript
// This works in both mock and production modes
const { user, login, logout } = useAuth();
const { usage, refreshUsage } = useUsage();
```

## 🎯 Benefits

- **Seamless Development**: Work with mock data while backend is being built
- **Easy Testing**: Test different scenarios with mock data
- **Gradual Migration**: Switch services one by one as backend becomes ready
- **Consistent Interface**: Same API for mock and real services
- **No Code Changes**: Screens and components work unchanged
- **Environment Control**: Fine-grained control over which services are mocked

## 🚦 Current Status

✅ Mock services implemented ✅ Service factory setup ✅ Unified app context ⏳
Real services (pending backend)

Ready for seamless backend integration!
