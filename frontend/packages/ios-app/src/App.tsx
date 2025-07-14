import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import Toast from 'react-native-toast-message';
import { AppProvider } from './contexts/AppContext';
import { RootNavigator } from './navigation/RootNavigator';
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher';

export default function App() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <RootNavigator />
          <EnvironmentSwitcher />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </NavigationContainer>
        <Toast />
      </AppProvider>
    </SafeAreaProvider>
  );
}
