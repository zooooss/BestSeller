// UsDetail.js
import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';

export default function UsDetail({ route, navigation }) {
  const { book } = route.params;

  return (
    <View style={styles.container}>
      {/* 상단 네비 버튼 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.navText}>⬅ 뒤로가기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.navText}>🏠 홈</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: book.image }} style={styles.image} />
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{book.author || '저자 정보 없음'}</Text>

        <Text style={styles.section}>📖 책 소개</Text>
        <Text style={styles.text}>
          Amazon 베스트셀러에 선정된 인기 도서입니다. 자세한 줄거리와 리뷰는
          아래 버튼을 눌러 Amazon에서 확인하세요.
        </Text>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL(book.link)}
        >
          <Text style={styles.linkText}>🔗 Amazon에서 보기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navText: { color: '#ff8c00', fontSize: 16 },
  image: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  author: { color: '#bbb', fontSize: 16, marginBottom: 16 },
  section: { color: '#ff8c00', fontSize: 18, marginBottom: 8 },
  text: { color: '#ddd', fontSize: 15, lineHeight: 22 },
  linkButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
