import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BookmarkContext = createContext();

export const BookmarkProvider = ({ children }) => {
  const [bookmarks, setBookmarks] = useState([]);

  // 북마크 불러오기
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const stored = await AsyncStorage.getItem('bookmarks');
      if (stored) {
        setBookmarks(JSON.parse(stored));
      }
    } catch (error) {
      console.error('북마크 불러오기 실패:', error);
    }
  };

  // 북마크 저장
  const saveBookmarks = async newBookmarks => {
    try {
      await AsyncStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks);
    } catch (error) {
      console.error('북마크 저장 실패:', error);
    }
  };

  // 북마크 추가
  const addBookmark = book => {
    const newBookmark = {
      ...book,
      id: `${book.title}_${Date.now()}`, // 고유 ID
      bookmarkedAt: new Date().toISOString(),
    };
    const newBookmarks = [...bookmarks, newBookmark];
    saveBookmarks(newBookmarks);
  };

  // 북마크 삭제
  const removeBookmark = bookId => {
    const newBookmarks = bookmarks.filter(b => b.id !== bookId);
    saveBookmarks(newBookmarks);
  };

  // 북마크 여부 확인
  const isBookmarked = bookTitle => {
    return bookmarks.some(b => b.title === bookTitle);
  };

  // 북마크 토글
  const toggleBookmark = book => {
    if (isBookmarked(book.title)) {
      const bookToRemove = bookmarks.find(b => b.title === book.title);
      removeBookmark(bookToRemove.id);
    } else {
      addBookmark(book);
    }
  };

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        toggleBookmark,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmark = () => useContext(BookmarkContext);
