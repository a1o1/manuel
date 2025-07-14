import { BaseApi } from './baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class AuthApi extends BaseApi {
  async login(email: string, password: string) {
    const response = await this.post(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    });

    if (response.data && response.data.token) {
      // Store token for future requests
      await AsyncStorage.setItem('authToken', response.data.token);
      await AsyncStorage.setItem('userId', response.data.user.id);
    }

    return response;
  }

  async signup(email: string, password: string, name: string) {
    return this.post(API_ENDPOINTS.AUTH.SIGNUP, {
      email,
      password,
      name,
    });
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userId');
    return { data: { message: 'Logged out successfully' }, status: 200 };
  }

  async getCurrentUser() {
    const token = await this.getAuthToken();
    if (!token) {
      return { data: null, status: 401 };
    }

    // For now, return cached user data
    const userId = await AsyncStorage.getItem('userId');
    return {
      data: userId ? { id: userId } : null,
      status: 200,
    };
  }

  async confirmSignup(email: string, code: string) {
    return this.post(API_ENDPOINTS.AUTH.CONFIRM, {
      email,
      code,
    });
  }

  async forgotPassword(email: string) {
    return this.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      email,
    });
  }

  async confirmForgotPassword(email: string, code: string, newPassword: string) {
    return this.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      email,
      code,
      newPassword,
    });
  }
}
