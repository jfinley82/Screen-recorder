import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";

interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/login", { replace: true }),
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        logout: () => logoutMut.mutate(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
