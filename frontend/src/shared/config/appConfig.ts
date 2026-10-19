import { Platform } from 'react-native';

// Android emulator: 10.0.2.2 is the host PC. For a physical device, use
// `adb reverse tcp:8080 tcp:8080` and change this URL to http://localhost:8080.
const developmentApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080',
});

// Set the HTTPS API URL here when a deployment environment is available.
const productionApiBaseUrl = '';

export const appConfig = {
  apiBaseUrl: __DEV__ ? developmentApiBaseUrl : productionApiBaseUrl,
  requestTimeoutMs: 5000,
};
