import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function WebDatePicker({
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Select date...',
}) {
  const { colors, isDark } = useTheme();
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Keep track of the month/year currently viewed in the calendar
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    } else {
      setViewDate(new Date());
    }
  }, [value, showCalendar]);

  const handleOpen = () => {
    setShowCalendar(true);
  };

  const handleClose = () => {
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    setViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    setViewDate(next);
  };

  const selectDate = (day) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(selected);
    handleClose();
  };

  // Helper to format date display (e.g. MM/DD/YYYY)
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week (0-6)

  // Generate days array: prefix nulls for padding, then day numbers 1..N
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const today = new Date();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.inputDisplay,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
        <Text
          style={[
            styles.inputText,
            {
              color: value ? colors.text : colors.textSub,
            },
          ]}
        >
          {value ? formatDate(value) : placeholder}
        </Text>
        {value && onChange && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            style={styles.clearBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable
            style={[
              styles.calendarCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: isDark ? '#000000' : '#64748b',
              },
            ]}
            onPress={(e) => e.stopPropagation()} // Prevent closing when clicking card
          >
            {/* Header: Month and Navigation */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {monthNames[month]} {year}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekdays Labels */}
            <View style={styles.weekdaysRow}>
              {weekdays.map((day, index) => (
                <Text key={index} style={[styles.weekdayText, { color: colors.textSub }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                }

                const cellDate = new Date(year, month, day);
                cellDate.setHours(0, 0, 0, 0);

                let isSelected = false;
                if (value) {
                  const valDate = new Date(value);
                  isSelected =
                    valDate.getDate() === day &&
                    valDate.getMonth() === month &&
                    valDate.getFullYear() === year;
                }

                const isToday =
                  today.getDate() === day &&
                  today.getMonth() === month &&
                  today.getFullYear() === year;

                let disabled = false;
                if (minimumDate) {
                  const min = new Date(minimumDate);
                  min.setHours(0, 0, 0, 0);
                  if (cellDate < min) disabled = true;
                }
                if (maximumDate) {
                  const max = new Date(maximumDate);
                  max.setHours(0, 0, 0, 0);
                  if (cellDate > max) disabled = true;
                }

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.accent, borderRadius: 8 },
                      !isSelected && isToday && {
                        borderWidth: 1.5,
                        borderColor: colors.accent,
                        borderRadius: 8,
                      },
                    ]}
                    onPress={() => selectDate(day)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.text },
                        isSelected && { color: '#ffffff', fontWeight: 'bold' },
                        disabled && { color: colors.textSub, opacity: 0.3 },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 48,
  },
  inputText: {
    fontSize: 15,
    flex: 1,
  },
  clearBtn: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate 900 with opacity
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarCard: {
    width: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCellEmpty: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  dayText: {
    fontSize: 14,
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
