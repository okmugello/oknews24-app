import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';

const DEVICE_ID_KEY = 'oknews24_device_id';

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  const brand = Device.brand || '';
  const model = Device.modelName || Device.deviceName || 'Dispositivo';
  return brand ? `${brand} ${model}` : model;
}
