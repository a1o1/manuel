import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
export type AuthStackParamList = {
    Login: undefined;
    Signup: undefined;
    ForgotPassword: undefined;
};
export type MainTabParamList = {
    Home: undefined;
    Query: undefined;
    Manuals: undefined;
    Usage: undefined;
};
export type HomeStackParamList = {
    HomeScreen: undefined;
    Settings: undefined;
};
export type QueryStackParamList = {
    QueryScreen: undefined;
    QueryHistory: undefined;
};
export type ManualStackParamList = {
    ManualList: undefined;
    ManualUpload: undefined;
    ManualDownload: undefined;
    ManualDetails: {
        manualKey: string;
    };
};
export type UsageStackParamList = {
    UsageOverview: undefined;
    UsageHistory: undefined;
    CostBreakdown: undefined;
};
export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    Loading: undefined;
};
export type AuthScreenProps<T extends keyof AuthStackParamList> = StackScreenProps<AuthStackParamList, T>;
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, T>, StackScreenProps<RootStackParamList>>;
export type HomeScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<StackScreenProps<HomeStackParamList, T>, MainTabScreenProps<keyof MainTabParamList>>;
export type QueryScreenProps<T extends keyof QueryStackParamList> = CompositeScreenProps<StackScreenProps<QueryStackParamList, T>, MainTabScreenProps<keyof MainTabParamList>>;
export type ManualScreenProps<T extends keyof ManualStackParamList> = CompositeScreenProps<StackScreenProps<ManualStackParamList, T>, MainTabScreenProps<keyof MainTabParamList>>;
export type UsageScreenProps<T extends keyof UsageStackParamList> = CompositeScreenProps<StackScreenProps<UsageStackParamList, T>, MainTabScreenProps<keyof MainTabParamList>>;
export type RootScreenProps<T extends keyof RootStackParamList> = StackScreenProps<RootStackParamList, T>;
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {
        }
    }
}
//# sourceMappingURL=navigation.d.ts.map