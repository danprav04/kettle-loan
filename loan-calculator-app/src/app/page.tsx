"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // <-- Changed from next-intl/navigation
import { useTranslations } from 'next-intl';

export default function AuthPage() {
    const t = useTranslations('Auth');
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (res.ok) {
            if (isLogin) {
                localStorage.setItem('token', data.token);
                router.push('/rooms');
            } else {
                setIsLogin(true);
            }
        } else {
            setError(t(data.message as any));
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">{isLogin ? t('login') : t('signup')}</h1>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="username">{t('username')}</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2" htmlFor="password">{t('password')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                    <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                        {isLogin ? t('login') : t('signup')}
                    </button>
                </form>
                <button onClick={() => setIsLogin(!isLogin)} className="mt-4 text-center w-full text-sm text-blue-500 hover:underline">
                    {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
                </button>
            </div>
        </div>
    );
}