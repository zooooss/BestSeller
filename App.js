import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import KrMain from './country/krmain';
import UsMain from './country/usmain';
import JpMain from './country/jpmain';
import JpDetail from './country/jpdetail';
import KrDetail from './country/krdetail';
import UsDetail from './country/usdetail';
import { BookmarkProvider } from './BookmarkContext';
import BookmarkScreen from './Bookmark';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.countryButton}
        onPress={() => navigation.navigate('Bookmark')}
      >
        <Text style={styles.buttonText}>🔖 내 북마크 확인하기</Text>
      </TouchableOpacity>
      <Text style={styles.title}>🌏 나라를 선택하세요</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('KrMain')}
      >
        <Text style={styles.text}>🇰🇷 한국 베스트셀러</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('UsMain')}
      >
        <Text style={styles.text}>🇺🇸 미국 베스트셀러</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('JpMain')}
      >
        <Text style={styles.text}>🇯🇵 일본 베스트셀러</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return (
    <BookmarkProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="KrMain" component={KrMain} />
          <Stack.Screen name="UsMain" component={UsMain} />
          <Stack.Screen name="KrDetail" component={KrDetail} />
          <Stack.Screen name="UsDetail" component={UsDetail} />
          <Stack.Screen name="JpMain" component={JpMain} />
          <Stack.Screen name="JpDetail" component={JpDetail} />
          <Stack.Screen name="Bookmark" component={BookmarkScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </BookmarkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    color: '#4e6bb5ff',
    marginBottom: 25,
    marginTop: 25,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4e6bb5ff',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 12,
    marginVertical: 10,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  countryButton: {
    backgroundColor: '#4e6bb5ff', // 오렌지 색
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
