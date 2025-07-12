import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { HomeScreen } from '../screens/main/HomeScreen';
import { QueryScreen } from '../screens/main/QueryScreen';
import { ManualsScreen } from '../screens/main/ManualsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { VoiceQueryScreen } from '../screens/main/VoiceQueryScreen';
import { ManualDetailScreen } from '../screens/main/ManualDetailScreen';
import { UsageScreen } from '../screens/main/UsageScreen';

export type MainTabParamList = {
  Home: undefined;
  Query: undefined;
  Manuals: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  VoiceQuery: undefined;
  ManualDetail: { manualId: string };
  Usage: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function MainTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Query') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Manuals') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: isDark ? '#8E8E93' : '#8E8E93',
        tabBarStyle: {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderTopColor: isDark ? '#38383A' : '#C6C6C8',
        },
        headerStyle: {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        },
        headerTintColor: isDark ? '#FFFFFF' : '#000000',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Query"
        component={QueryScreen}
        options={{ title: 'Ask Manuel' }}
      />
      <Tab.Screen
        name="Manuals"
        component={ManualsScreen}
        options={{ title: 'Manuals' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VoiceQuery"
        component={VoiceQueryScreen}
        options={{
          title: 'Voice Query',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="ManualDetail"
        component={ManualDetailScreen}
        options={{ title: 'Manual Details' }}
      />
      <Stack.Screen
        name="Usage"
        component={UsageScreen}
        options={{ title: 'Usage Statistics' }}
      />
    </Stack.Navigator>
  );
}
