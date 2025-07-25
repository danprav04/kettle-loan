// src/components/UserProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  userId: number;
  username: string;
}

interface UserContextType {
  user: User | null;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// A simple and safe JWT payload decoder
function decodeToken(token: string): User | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        
        const decoded = JSON.parse(jsonPayload);
        // Ensure the decoded token has the properties we expect for a valid user
        if (decoded.userId && decoded.username) {
            return { userId: decoded.userId, username: decoded.username };
        }
        return null;
    } catch (e) {
        console.error("Failed to decode token:", e);
        return null;
    }
}

export default function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
        router.push('/');
    }, [router]);

    const checkUser = useCallback(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const decodedUser = decodeToken(token);
            if (decodedUser) {
                setUser(decodedUser);
            } else {
                logout(); // Token is invalid or malformed
            }
        } else {
            setUser(null);
        }
    }, [logout]);

    // Initial check and listen for changes in other tabs
    useEffect(() => {
        checkUser();
        
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'token') {
                checkUser();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [checkUser]);
    
    // Re-check user on route changes
    useEffect(() => {
        checkUser();
    }, [pathname, checkUser]);


    return (
        <UserContext.Provider value={{ user, logout }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}