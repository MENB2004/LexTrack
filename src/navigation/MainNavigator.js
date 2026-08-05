import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import Screens
import MainScreen from '../screens/MainScreen';
import CaseDetailScreen from '../screens/CaseDetailScreen';
import DayDashboardScreen from '../screens/DayDashboardScreen';

const Stack = createStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="DayDashboard" component={DayDashboardScreen} />
    </Stack.Navigator>
  );
}
