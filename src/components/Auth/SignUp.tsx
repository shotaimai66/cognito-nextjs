import { useState } from "react";

interface SignUpProps {
  onSuccess: () => void;
  onSwitch: () => void;
}

export default function SignUp({ onSuccess, onSwitch }: SignUpProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'サインアップに失敗しました');
      }

      setIsConfirming(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "サインアップに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 確認コードを送信
      const confirmResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/confirm-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          confirmationCode: confirmCode,
        }),
      });

      const confirmData = await confirmResponse.json();

      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || '確認に失敗しました');
      }

      // 確認成功後、自動的にサインイン
      const signinResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const signinData = await signinResponse.json();

      if (!signinResponse.ok) {
        throw new Error(signinData.error || 'ログインに失敗しました');
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "確認に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">メール確認</h2>
        <p className="mb-4 text-gray-600">
          {email}に送信された確認コードを入力してください
        </p>
        <form onSubmit={handleConfirm}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              確認コード
            </label>
            <input
              type="text"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          {error && (
            <div className="mb-4 text-red-500 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-200 disabled:opacity-50"
          >
            {loading ? '確認中...' : '確認'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">サインアップ</h2>
      <form onSubmit={handleSignUp}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={loading}
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            8文字以上、大文字・小文字・数字・特殊文字を含む
          </p>
        </div>
        {error && (
          <div className="mb-4 text-red-500 text-sm">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-200 disabled:opacity-50"
        >
          {loading ? 'サインアップ中...' : 'サインアップ'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        すでにアカウントをお持ちですか？{" "}
        <button
          onClick={onSwitch}
          className="text-blue-500 hover:underline"
          disabled={loading}
        >
          ログイン
        </button>
      </p>
    </div>
  );
}