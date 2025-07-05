import ProtectedRoute from "@/components/Layout/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">ダッシュボード</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">
                  {user?.username}
                </span>
                <button
                  onClick={signOut}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-200"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  ようこそ！
                </h2>
                <p className="text-gray-600">
                  認証が完了しました。これはプロテクトされたページです。
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}