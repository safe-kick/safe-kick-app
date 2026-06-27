import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="license-capture" />
        <Stack.Screen name="license-confirm" />
        <Stack.Screen name="main" />
        <Stack.Screen name="qr-scan" />
        <Stack.Screen name="selfie" />
        <Stack.Screen name="safety-check" />
        <Stack.Screen name="monitoring" />
        <Stack.Screen name="return-complete" />
        <Stack.Screen name="mypage" />
      </Stack>
    </>
  );
}
