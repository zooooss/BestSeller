import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

export default function KrDetail({ route, navigation }) {
  const { book } = route.params;

  return (
    <View style={styles.container}>
      {/* 상단 버튼 */}
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.navText}>⬅ 뒤로가기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.navText}>🏠 홈</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        <Image source={{ uri: book.image }} style={styles.image} />
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{book.author}</Text>

        <Text style={styles.sectionTitle}>📖 줄거리</Text>
        <Text style={styles.description}>
          {book.description
            ? book.description
            : '줄거리 정보가 없습니다. 추후 업데이트 예정입니다.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  navButton: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 10,
  },
  navText: { color: '#ff8c00', fontSize: 14 },
  image: { width: '50%', height: 300, borderRadius: 12, marginBottom: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  author: { color: '#ccc', fontSize: 16, marginBottom: 16 },
  sectionTitle: { color: '#ff8c00', fontSize: 18, marginBottom: 8 },
  description: { color: '#ddd', lineHeight: 22 },
});
