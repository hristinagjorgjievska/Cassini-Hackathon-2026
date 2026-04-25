"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: string) => Promise<void>;
  updateRole: (role: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A simple mock DB stored in localStorage to persist users
const getMockUsers = () => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("mock_users");
  if (stored) return JSON.parse(stored);
  // Default demo user
  const defaultUsers = [{ id: "demo-1", name: "Marko", email: "marko@example.com", pass: "password", role: "farmer" }];
  localStorage.setItem("mock_users", JSON.stringify(defaultUsers));
  return defaultUsers;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const storedUserId = localStorage.getItem("current_user_id");
    if (storedUserId) {
      const users = getMockUsers();
      const foundUser = users.find((u: any) => u.id === storedUserId);
      if (foundUser) {
        setUser({ id: foundUser.id, name: foundUser.name, email: foundUser.email, role: foundUser.role });
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    const users = getMockUsers();
    const found = users.find((u: any) => u.email === email && u.pass === pass);
    if (!found) throw new Error("Invalid email or password");
    
    const loggedInUser = { id: found.id, name: found.name, email: found.email, role: found.role };
    setUser(loggedInUser);
    localStorage.setItem("current_user_id", found.id);
    router.push("/my-map");
  };

  const signup = async (name: string, email: string, pass: string, role: string) => {
    const users = getMockUsers();
    if (users.find((u: any) => u.email === email)) {
      throw new Error("User with this email already exists");
    }
    
    const newUser = { id: `user-${Date.now()}`, name, email, pass, role };
    users.push(newUser);
    localStorage.setItem("mock_users", JSON.stringify(users));
    
    const loggedInUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    setUser(loggedInUser);
    localStorage.setItem("current_user_id", newUser.id);
    router.push("/my-map");
  };

  const updateRole = async (newRole: string) => {
    if (!user) return;
    
    // Update local state
    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);
    
    // Update mock DB
    const users = getMockUsers();
    const userIndex = users.findIndex((u: any) => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].role = newRole;
      localStorage.setItem("mock_users", JSON.stringify(users));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("current_user_id");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, updateRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
