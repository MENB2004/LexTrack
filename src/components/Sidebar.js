import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

const menuItems = [
  { name: 'Dashboard', label: 'Cases Dashboard', icon: 'folder-open-outline', activeIcon: 'folder-open' },
  { name: 'Calendar', label: 'Hearing Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'AddCase', label: 'Register New Case', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { name: 'Clients', label: 'Client Directory', icon: 'people-outline', activeIcon: 'people' },
  { name: 'Analytics', label: 'Caseload Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { name: 'Settings', label: 'Settings & Profiles', icon: 'settings-outline', activeIcon: 'settings' },
];

export default function Sidebar({ currentView, onSelect }) {
  const { isDark, colors } = useTheme();

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.drawerHeader, { borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Logo size={32} />
          <Text style={[styles.drawerLogo, { color: colors.text, marginLeft: 8 }]}>LexTrack</Text>
        </View>
      </View>

      <View style={styles.drawerMenu}>
        {menuItems.map((item) => {
          const isSelected = currentView === item.name;
          return (
            <Pressable
              key={item.name}
              onPress={() => onSelect(item.name)}
              style={({ hovered, pressed }) => [
                styles.drawerItem,
                isSelected 
                  ? { backgroundColor: isDark ? '#312e81' : '#e0e7ff' } 
                  : (hovered && { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', transform: [{ translateX: 4 }] }),
                pressed && { opacity: 0.7 }
              ]}
            >
              <Ionicons
                name={isSelected ? item.activeIcon : item.icon}
                size={20}
                color={isSelected ? colors.accent : colors.textSub}
                style={styles.drawerIcon}
              />
              <Text
                style={[
                  styles.drawerLabel,
                  { color: isSelected ? colors.accent : colors.text },
                  isSelected && { fontWeight: 'bold' },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.drawerFooter, { borderColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textSub }]}>LexTrack Counsel Portal</Text>
        <Text style={styles.footerVersion}>v1.0.6 Stable</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    borderRightWidth: 1,
    height: '100%',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  drawerLogo: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  drawerMenu: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  drawerIcon: {
    marginRight: 14,
  },
  drawerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerVersion: {
    fontSize: 10,
    marginTop: 4,
  },
});
