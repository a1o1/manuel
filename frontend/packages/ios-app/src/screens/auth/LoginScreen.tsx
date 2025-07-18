import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AppContext';
import { handleCognitoError, getActionButtonText } from '../../utils/cognitoErrors';
import { graphicsService } from '../../services/graphicsService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, confirmSignup, resendConfirmationCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      const cognitoError = handleCognitoError(error);

      Alert.alert(
        cognitoError.title,
        cognitoError.message,
        [
          {
            text: getActionButtonText(cognitoError.actionRequired),
            onPress: async () => {
              if (cognitoError.actionRequired === 'confirm_signup') {
                // Create confirmation code prompt
                showConfirmationPrompt();
              } else if (cognitoError.actionRequired === 'resend_code') {
                await handleResendCode();
              }
            }
          },
          ...(cognitoError.actionRequired === 'confirm_signup' ? [{
            text: 'Resend Code',
            onPress: async () => await handleResendCode()
          }] : [])
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    try {
      await resendConfirmationCode(email.trim());
      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your email.',
        [{ text: 'OK', onPress: showConfirmationPrompt }]
      );
    } catch (error) {
      const cognitoError = handleCognitoError(error);
      Alert.alert(cognitoError.title, cognitoError.message);
    }
  };

  const showConfirmationPrompt = () => {
    Alert.prompt(
      'Verify Account',
      'Enter the 6-digit code from your email:',
      async (code) => {
        if (code && code.length === 6) {
          try {
            await confirmSignup(email.trim(), code);
            Alert.alert(
              'Account Verified!',
              'Your account has been verified. You can now sign in.',
              [{ text: 'OK', onPress: () => handleLogin() }]
            );
          } catch (error) {
            const cognitoError = handleCognitoError(error);
            Alert.alert(cognitoError.title, cognitoError.message);
          }
        } else {
          Alert.alert('Invalid Code', 'Please enter a 6-digit verification code');
        }
      },
      'plain-text',
      '',
      'number-pad'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sign In</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.heroContainer}>
            <Image
              source={graphicsService.getSplashImage()}
              style={styles.heroImage}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Welcome to Manuel</Text>
            <Text style={styles.heroSubtitle}>Your AI-powered manual assistant</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#8E8E93"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#8E8E93"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotButtonText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signupPrompt}>
            <Text style={styles.signupPromptText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  form: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupPromptText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  signupLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
