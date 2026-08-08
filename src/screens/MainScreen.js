import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Pressable,
  BackHandler,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Logo from '../components/Logo';
import Sidebar from '../components/Sidebar';
import { supabase } from '../../lib/supabase';

// Import Screen Components
import DashboardScreen from './DashboardScreen';
import CalendarScreen from './CalendarScreen';
import AddCaseScreen from './AddCaseScreen';
import AnalyticsScreen from './AnalyticsScreen';
import SettingsScreen from './SettingsScreen';
import ClientListScreen from './ClientListScreen';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = 280;

export default function MainScreen({ navigation, route }) {
  const { isDark, colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  const [currentView, setCurrentView] = useState('Dashboard');

  useEffect(() => {
    if (route.params?.screen) {
      setCurrentView(route.params.screen);
      navigation.setParams({ screen: undefined });
    }
  }, [route.params?.screen]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const userRole = 'owner';

  useEffect(() => {
    const backAction = () => {
      if (currentView !== 'Dashboard') {
        setCurrentView('Dashboard');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [currentView]);

  const toggleDrawer = (open) => {
    if (open) {
      setDrawerOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setDrawerOpen(false);
      });
    }
  };

  const selectView = (viewName) => {
    setCurrentView(viewName);
    toggleDrawer(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'Dashboard':
        return <DashboardScreen navigation={navigation} selectView={selectView} />;
      case 'Calendar':
        return <CalendarScreen navigation={navigation} />;
      case 'AddCase':
        return <AddCaseScreen navigation={navigation} selectView={selectView} />;
      case 'Clients':
        return <ClientListScreen navigation={navigation} />;
      case 'Analytics':
        return <AnalyticsScreen navigation={navigation} />;
      case 'Settings':
        return <SettingsScreen navigation={navigation} />;
      default:
        return <DashboardScreen navigation={navigation} selectView={selectView} />;
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'Dashboard': return 'Cases Dashboard';
      case 'Calendar': return 'Hearing Calendar';
      case 'AddCase': return 'Register Case';
      case 'Clients': return 'Client Directory';
      case 'Analytics': return 'Caseload Analytics';
      case 'Settings': return 'App Settings';
      default: return 'LexTrack';
    }
  };

  const menuItems = [
    { name: 'Dashboard', label: 'Cases Dashboard', icon: 'folder-open-outline', activeIcon: 'folder-open' },
    { name: 'Calendar', label: 'Hearing Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
    { name: 'AddCase', label: 'Register New Case', icon: 'add-circle-outline', activeIcon: 'add-circle' },
    { name: 'Clients', label: 'Client Directory', icon: 'people-outline', activeIcon: 'people' },
    { name: 'Analytics', label: 'Caseload Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
    { name: 'Settings', label: 'Settings & Profiles', icon: 'settings-outline', activeIcon: 'settings' },
  ];

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { backgroundColor: colors.background }, 
        Platform.OS === 'web' && { height: '100vh', overflow: 'hidden' }
      ]} 
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={{ flexDirection: 'row', flex: 1 }}>
        {/* PERSISTENT SIDEBAR FOR DESKTOP */}
        {isDesktop && (
          <Sidebar currentView={currentView} onSelect={(screenName) => setCurrentView(screenName)} />
        )}

        {/* MAIN PANEL CONTENT */}
        <View style={{ flex: 1 }}>
          {/* TOP HEADER BAR */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {!isDesktop ? (
              currentView !== 'Dashboard' ? (
                <TouchableOpacity
                  onPress={() => selectView('Dashboard')}
                  style={styles.menuButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={26} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => toggleDrawer(true)}
                  style={styles.menuButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="menu" size={26} color={colors.text} />
                </TouchableOpacity>
              )
            ) : null}
            <Text style={[styles.headerTitle, { color: colors.text, marginLeft: isDesktop ? 8 : 0 }]}>
              {getViewTitle()}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* ACTIVE SCREEN CONTENT */}
          <View style={styles.mainContent}>
            {renderContent()}
          </View>
        </View>
      </View>

      {/* DRAWER SLIDEOUT NAVIGATION OVERLAY (Mobile only) */}
      {!isDesktop && drawerOpen && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
              backgroundColor: '#000000',
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDrawer(false)} />
        </Animated.View>
      )}

      {!isDesktop && (
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              transform: [{ translateX: slideAnim }],
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.drawerHeader, { borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Logo size={32} />
              <Text style={[styles.drawerLogo, { color: colors.text, marginLeft: 8 }]}>LexTrack</Text>
            </View>
            <TouchableOpacity onPress={() => toggleDrawer(false)}>
              <Ionicons name="close" size={24} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          <View style={styles.drawerMenu}>
            {menuItems.map((item) => {
              const isSelected = currentView === item.name;
              return (
                <Pressable
                  key={item.name}
                  onPress={() => selectView(item.name)}
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
            <Text style={styles.footerVersion}>v1.0.0 Stable</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sidebar: {
    width: 260,
    borderRightWidth: 1,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 5,
  },
  menuButton: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 10,
    borderRightWidth: 1,
    paddingTop: StatusBar.currentHeight || 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    color: '#94a3b8',
    marginTop: 4,
  },
});
