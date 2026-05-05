import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1a1a1a',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Closet', tabBarIcon: tabIcon('shirt-outline') }}
      />
      <Tabs.Screen
        name="outfits"
        options={{ title: 'Outfits', tabBarIcon: tabIcon('layers-outline') }}
      />
      <Tabs.Screen
        name="palette"
        options={{ title: 'Palette', tabBarIcon: tabIcon('color-palette-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
