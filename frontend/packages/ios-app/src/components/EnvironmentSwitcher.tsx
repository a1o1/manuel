import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ENV_CONFIG, switchToMock, switchToProduction, isMockMode } from '../config/environment';
import { mockUserContext } from '../services/mock/userContext';

export function EnvironmentSwitcher() {
  const [isVisible, setIsVisible] = useState(false);

  if (!ENV_CONFIG.DEV.SHOW_DEV_INDICATORS) {
    return null;
  }

  const handleSwitchMode = () => {
    if (isMockMode()) {
      switchToProduction();
    } else {
      switchToMock();
    }
    Alert.alert('Restart Required', 'Please restart the app to apply changes', [
      { text: 'OK', onPress: () => setIsVisible(false) }
    ]);
  };

  const switchUser = (userId: string, userName: string) => {
    mockUserContext.setCurrentUserId(userId);
    Alert.alert(
      'User Switched',
      `Now viewing data for ${userName}. Navigate between tabs to see the changes.`,
      [{ text: 'OK', onPress: () => setIsVisible(false) }]
    );
  };

  const currentUserId = mockUserContext.getCurrentUserId();

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={() => setIsVisible(true)}>
          <Text style={styles.text}>
            🔧 {ENV_CONFIG.MODE.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Development Settings</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Environment</Text>
              <Text style={styles.currentMode}>Current: {ENV_CONFIG.MODE}</Text>
              <Text style={styles.featureDescription}>
                {isMockMode()
                  ? 'Mock: Simulated data, no network calls'
                  : 'Production: Real API, enhanced errors, rate limits, retries'
                }
              </Text>
              <TouchableOpacity style={styles.switchButton} onPress={handleSwitchMode}>
                <Text style={styles.switchButtonText}>
                  Switch to {isMockMode() ? 'Production' : 'Mock'}
                </Text>
              </TouchableOpacity>
            </View>

            {isMockMode() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mock User</Text>
                <Text style={styles.currentMode}>Current: {mockUserContext.getCurrentUserName()}</Text>

                <TouchableOpacity
                  style={[styles.userButton, currentUserId === 'user1' && styles.activeUserButton]}
                  onPress={() => switchUser('user1', 'John Doe')}
                >
                  <Text style={[styles.userButtonText, currentUserId === 'user1' && styles.activeUserButtonText]}>
                    John Doe (Router + TV)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.userButton, currentUserId === 'user2' && styles.activeUserButton]}
                  onPress={() => switchUser('user2', 'Jane Smith')}
                >
                  <Text style={[styles.userButtonText, currentUserId === 'user2' && styles.activeUserButtonText]}>
                    Jane Smith (Coffee Machine)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.userButton, currentUserId === 'user3' && styles.activeUserButton]}
                  onPress={() => switchUser('user3', 'Mike Johnson')}
                >
                  <Text style={[styles.userButtonText, currentUserId === 'user3' && styles.activeUserButtonText]}>
                    Mike Johnson (No Manuals)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    minWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  section: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  currentMode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  switchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  switchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  userButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 200,
  },
  activeUserButton: {
    backgroundColor: '#007AFF',
  },
  userButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeUserButtonText: {
    color: '#FFFFFF',
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  featureDescription: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});
