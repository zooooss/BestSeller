// JpDetail.js
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';

export default function JpDetail({ route, navigation }) {
  const { book } = route.params;

  return (
    <View style={styles.container}>
      <Image source={{ uri: book.image }} style={styles.image} />
      <Text style={styles.title}>{book.title}</Text>
      <Text style={styles.author}>{book.author}</Text>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => Linking.openURL(book.link)}
      >
        <Text style={styles.linkText}>📖 詳細ページを見る</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.navText}>⬅ 戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    padding: 20,
  },
  image: { width: 200, height: 270, borderRadius: 10, marginBottom: 20 },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  author: { color: '#ccc', fontSize: 16, marginVertical: 10 },
  linkButton: {
    backgroundColor: '#ff8c00',
    padding: 12,
    borderRadius: 10,
    marginVertical: 20,
  },
  linkText: { color: '#000', fontWeight: 'bold' },
  navButton: { backgroundColor: '#222', padding: 10, borderRadius: 8 },
  navText: { color: '#ff8c00' },
});
