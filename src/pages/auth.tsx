import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import SignIn from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, checkUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleAuthSuccess = async () => {
    await checkUser();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {isSignUp ? (
        <SignUp
          onSuccess={handleAuthSuccess}
          onSwitch={() => setIsSignUp(false)}
        />
      ) : (
        <SignIn
          onSuccess={handleAuthSuccess}
          onSwitch={() => setIsSignUp(true)}
        />
      )}
    </div>
  );
}