import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type Source = 'camera' | 'library';

// Wraps expo-image-picker permission + launch flow with explicit error
// surfaces. The default behavior is to silently `return` when a permission is
// denied, which makes the buttons appear broken — this version tells the user
// what to do.
export async function pickImage(
  source: Source
): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!perm.granted) {
    const what = source === 'camera' ? 'camera' : 'photo library';
    if (perm.canAskAgain) {
      Alert.alert(
        `${what[0].toUpperCase()}${what.slice(1)} access needed`,
        `Please allow access to your ${what} to continue.`
      );
    } else {
      Alert.alert(
        `${what[0].toUpperCase()}${what.slice(1)} access blocked`,
        `Open Settings and enable ${what} access for ${
          Platform.OS === 'ios' ? 'Expo Go (or ClosetCore)' : 'this app'
        }.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return null;
  }

  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
  };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0];
}
