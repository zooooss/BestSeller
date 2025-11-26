// JpDetail.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useBookmark } from '../BookmarkContext';

export default function JpDetail({ route, navigation }) {
  const { book } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isBookmarked, toggleBookmark } = useBookmark();

  // 📘 책 상세 정보 가져오기
  useEffect(() => {
    if (book.link) {
      console.log('📘 요청 URL:', book.link);

      fetch(
        `http://10.0.2.2:4000/jp-book-detail?url=${encodeURIComponent(
          book.link,
        )}`,
      )
        .then(res => {
          console.log('📘 응답 상태:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('📘 받은 데이터:', data);
          setDetails(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('❌ Detail Fetch Error:', err);
          setLoading(false);
        });
    } else {
      console.log('⚠️ book.link가 없습니다');
      setLoading(false);
    }
  }, [book.link]);

  return (
    <View style={styles.container}>
      {/* 상단 네비 버튼 */}
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.navText}>⬅ 戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.navText}>🏠 ホーム</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: book.image }} style={styles.image} />
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={() => toggleBookmark({ ...book, country: 'JP' })} // item → book
        >
          <Text style={styles.bookmarkIcon}>
            {isBookmarked(book.title) ? '⭐' : '☆'} {/* item → book */}
          </Text>
        </TouchableOpacity>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{book.author || '著者情報なし'}</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff8c00" />
            <Text style={styles.loadingText}>상세 정보 불러오는 중...</Text>
          </View>
        ) : (
          <>
            {/* 출판 정보 */}
            {details?.publisher && (
              <>
                <Text style={styles.section}>📚 出版情報</Text>
                <Text style={styles.text}>{details.publisher}</Text>
                {details.publishDate && (
                  <Text style={styles.text}>発行日: {details.publishDate}</Text>
                )}
              </>
            )}

            {/* 책 정보 */}
            {details?.description && (
              <>
                <Text style={styles.section}>📖 書籍情報</Text>
                <Text style={styles.text}>{details.description}</Text>
              </>
            )}

            {/* 내용 설명 */}
            {details?.plot && (
              <>
                <Text style={styles.section}>📝 内容説明</Text>
                <Text style={styles.text}>{details.plot}</Text>
              </>
            )}

            {/* 저자 소개 */}
            {details?.authorInfo && (
              <>
                <Text style={styles.section}>✍️ 著者紹介</Text>
                <Text style={styles.text}>{details.authorInfo}</Text>
              </>
            )}
          </>
        )}

        {book.link && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => Linking.openURL(book.link)}
          >
            <Text style={styles.linkText}>🔗 紀伊國屋書店で詳しく見る</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
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
  image: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  author: { color: '#bbb', fontSize: 16, marginBottom: 16 },
  section: {
    color: '#ff8c00',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  text: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    color: '#ccc',
    marginTop: 10,
    fontSize: 14,
  },
  linkButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  linkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 25,
  },
  bookmarkButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkIcon: {
    fontSize: 20,
  },
});
