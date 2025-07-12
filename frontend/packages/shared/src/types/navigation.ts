import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Query: undefined;
  Manuals: undefined;
  Usage: undefined;
};

// Home Stack
export type HomeStackParamList = {
  HomeScreen: undefined;
  Settings: undefined;
};

// Query Stack
export type QueryStackParamList = {
  QueryScreen: undefined;
  QueryHistory: undefined;
};

// Manual Stack
export type ManualStackParamList = {
  ManualList: undefined;
  ManualUpload: undefined;
  ManualDownload: undefined;
  ManualDetails: { manualKey: string };
};

// Usage Stack
export type UsageStackParamList = {
  UsageOverview: undefined;
  UsageHistory: undefined;
  CostBreakdown: undefined;
};

// Root Stack (contains Auth and Main)
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
};

// Screen Props Types
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  StackScreenProps<AuthStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    StackScreenProps<RootStackParamList>
  >;

export type HomeScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    StackScreenProps<HomeStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type QueryScreenProps<T extends keyof QueryStackParamList> =
  CompositeScreenProps<
    StackScreenProps<QueryStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type ManualScreenProps<T extends keyof ManualStackParamList> =
  CompositeScreenProps<
    StackScreenProps<ManualStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type UsageScreenProps<T extends keyof UsageStackParamList> =
  CompositeScreenProps<
    StackScreenProps<UsageStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type RootScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
