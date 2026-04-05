import { Redirect } from 'expo-router';

export default function AuthIndex() {
  // Redirect to login page by default
  return <Redirect href="/(auth)/login" />;
}
