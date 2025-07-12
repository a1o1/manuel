import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ENV_CONFIG, switchToMock, switchToProduction, isMockMode } from '../config/environment';

export function EnvironmentSwitcher() {
  if (!ENV_CONFIG.DEV.SHOW_DEV_INDICATORS) {
    return null;
  }

  const handleSwitchMode = () => {
    Alert.alert(
      'Switch Environment',
      `Currently in ${ENV_CONFIG.MODE} mode. Switch to ${isMockMode() ? 'production' : 'mock'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            if (isMockMode()) {
              switchToProduction();
            } else {
              switchToMock();
            }
            Alert.alert('Restart Required', 'Please restart the app to apply changes');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleSwitchMode}>
        <Text style={styles.text}>
          🔧 {ENV_CONFIG.MODE.toUpperCase()} MODE
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    zIndex: 1000,
  },
  button: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
