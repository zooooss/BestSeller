import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function UsMain({ navigation }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 📘 Amazon 베스트셀러 데이터 가져오기
  useEffect(() => {
    fetch('http://10.0.2.2:4000/us-books')
      .then(res => res.json())
      .then(data => {
        setBooks(data.books || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Fetch Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff8c00" />
        <Text style={{ color: '#ccc', marginTop: 10 }}>불러오는 중...</Text>
      </View>
    );
  }

  // 📚 카드 렌더링
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('UsDetail', {
          book: {
            title: item.title,
            author: item.author,
            image: item.image,
            link: item.link, //link 추가
            country: 'US',
          },
        })
      }
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={{ color: '#555' }}>No Image</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {item.author || 'Unknown Author'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 상단 버튼 */}
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.navText}>⬅ BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.navText}>🏠 HOME</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.header}>🇺🇸 미국 베스트셀러 TOP 20</Text>

      <FlatList
        data={books.slice(0, 20)}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-around' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20 },
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
  header: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: { flex: 1, alignItems: 'center', marginBottom: 25 },
  image: {
    width: 150,
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 150,
    height: 200,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  title: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
  },
  author: { fontSize: 12, color: '#ccc', textAlign: 'center' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
