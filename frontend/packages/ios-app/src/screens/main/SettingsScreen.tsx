import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@manuel/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type SettingsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress: () => void;
  rightElement?: 'arrow' | 'text';
  rightText?: string;
}

export function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        {
          title: 'Profile',
          subtitle: user?.email || 'No email',
          icon: 'person-outline',
          iconColor: '#007AFF',
          onPress: () => Alert.alert('Coming Soon', 'Profile editing will be available soon'),
          rightElement: 'arrow',
        },
        {
          title: 'Usage Statistics',
          subtitle: 'View your query usage and costs',
          icon: 'analytics-outline',
          iconColor: '#5856D6',
          onPress: () => navigation.navigate('Usage'),
          rightElement: 'arrow',
        },
      ],
    },
    {
      title: 'App Settings',
      items: [
        {
          title: 'Notifications',
          subtitle: 'Manage notification preferences',
          icon: 'notifications-outline',
          iconColor: '#FF9500',
          onPress: () => Alert.alert('Coming Soon', 'Notification settings will be available soon'),
          rightElement: 'arrow',
        },
        {
          title: 'Voice Settings',
          subtitle: 'Configure microphone and audio',
          icon: 'mic-outline',
          iconColor: '#34C759',
          onPress: () => Alert.alert('Coming Soon', 'Voice settings will be available soon'),
          rightElement: 'arrow',
        },
        {
          title: 'Storage',
          subtitle: 'Manage downloaded content',
          icon: 'archive-outline',
          iconColor: '#8E8E93',
          onPress: () => Alert.alert('Coming Soon', 'Storage management will be available soon'),
          rightElement: 'arrow',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          icon: 'help-circle-outline',
          iconColor: '#007AFF',
          onPress: () => Alert.alert('Support', 'For support, please email support@manuel.ai'),
          rightElement: 'arrow',
        },
        {
          title: 'Privacy Policy',
          subtitle: 'Read our privacy policy',
          icon: 'shield-outline',
          iconColor: '#8E8E93',
          onPress: () => Alert.alert('Coming Soon', 'Privacy policy will be available soon'),
          rightElement: 'arrow',
        },
        {
          title: 'Terms of Service',
          subtitle: 'Read our terms of service',
          icon: 'document-outline',
          iconColor: '#8E8E93',
          onPress: () => Alert.alert('Coming Soon', 'Terms of service will be available soon'),
          rightElement: 'arrow',
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          title: 'Sign Out',
          icon: 'log-out-outline',
          iconColor: '#FF3B30',
          onPress: handleLogout,
        },
      ],
    },
  ];

  const renderItem = (item: SettingsItem) => (
    <TouchableOpacity key={item.title} style={styles.settingsItem} onPress={item.onPress}>
      <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
          <Ionicons name={item.icon} size={20} color={item.iconColor} />
        </View>
        <View style={styles.itemText}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>

      <View style={styles.itemRight}>
        {item.rightText && (
          <Text style={styles.rightText}>{item.rightText}</Text>
        )}
        {item.rightElement === 'arrow' && (
          <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: SettingsSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderItem)}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {user && (
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {user.firstName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || 'User'
                }
              </Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        )}

        {sections.map(renderSection)}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Manuel v1.0.0</Text>
          <Text style={styles.footerSubtext}>Voice assistant for product manuals</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightText: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#C7C7CC',
  },
});
