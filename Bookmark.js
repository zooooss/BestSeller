import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useBookmark } from './BookmarkContext';

export default function Bookmark({ navigation }) {
  const { bookmarks, removeBookmark } = useBookmark();

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.bookInfo}
        onPress={() => {
          const detailPage =
            item.country === 'KR'
              ? 'KrDetail'
              : item.country === 'US'
              ? 'UsDetail'
              : 'JpDetail';

          navigation.navigate(detailPage, { book: item });
        }}
      >
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.image} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.country}>
            {item.country === 'KR' ? '🇰🇷' : item.country === 'US' ? '🇺🇸' : '🇯🇵'}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {item.author}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeBookmark(item.id)}
      >
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
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

      <Text style={styles.headerTitle}>🔖 내 북마크</Text>

      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>북마크한 책이 없습니다</Text>
          <Text style={styles.emptySubText}>
            책 목록에서 ☆를 눌러 북마크하세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          renderItem={renderItem}
          keyExtractor={item => item.id}
        />
      )}
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
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  bookInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  image: {
    width: 80,
    height: 110,
    borderRadius: 8,
    marginRight: 15,
  },
  textContainer: { flex: 1 },
  country: { fontSize: 20, marginBottom: 5 },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  author: { color: '#ccc', fontSize: 14 },
  deleteButton: {
    padding: 10,
  },
  deleteText: { fontSize: 24 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  emptySubText: {
    color: '#999',
    fontSize: 14,
  },
});
