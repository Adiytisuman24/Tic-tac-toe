import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  username: string;
  isGuest: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DUMMY_USERS = [
  { email: 'user1@test.com', password: 'password123', username: 'Player 1' },
  { email: 'user2@test.com', password: 'password123', username: 'Player 2' },
  { email: 'test@test.com', password: 'test123', username: 'Test Player' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const foundUser = DUMMY_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!foundUser) {
      throw new Error('Invalid email or password');
    }

    const user: User = {
      id: email,
      email: foundUser.email,
      username: foundUser.username,
      isGuest: false,
    };

    await AsyncStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const loginAsGuest = async () => {
    const guestId = `guest_${Date.now()}`;
    const user: User = {
      id: guestId,
      email: '',
      username: `Guest${Math.floor(Math.random() * 1000)}`,
      isGuest: true,
    };

    await AsyncStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
