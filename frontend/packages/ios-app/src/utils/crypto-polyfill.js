// Crypto polyfill for React Native
// Required for amazon-cognito-identity-js

// Import polyfills
import 'react-native-get-random-values';

// Global crypto object for React Native
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = (array) => {
    const { getRandomBytes } = require('react-native-get-random-values');
    const bytes = getRandomBytes(array.length);
    for (let i = 0; i < array.length; i++) {
      array[i] = bytes[i];
    }
    return array;
  };
}

// Ensure Buffer is available globally for Cognito SDK
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Add atob and btoa polyfills for JWT parsing
if (typeof global.atob === 'undefined') {
  global.atob = function(str) {
    return Buffer.from(str, 'base64').toString('binary');
  };
}

if (typeof global.btoa === 'undefined') {
  global.btoa = function(str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}

export default global.crypto;
