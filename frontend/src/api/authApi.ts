import apiClient from "./axiosConfig";

// تعريف أنواع البيانات (Interfaces)
export interface LoginData {
  phone: string;
  password?: string;
}

export interface SignupData {
  name: string;
  email: string;
  phone: string;
  password?: string;
}

export interface StaffData {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: "admin" | "employee";
}

// الـ Requests
export const login = (data: LoginData) => apiClient.post("/users/login", data);
export const signup = (data: SignupData) => apiClient.post("/users/signup", data);
export const getMe = () => apiClient.get("/users/me");

// إدارة الموظفين (للمدير)
export const getAllStaff = () => apiClient.get("/users/staff");
export const createStaff = (data: StaffData) => apiClient.post("/users/staff", data);
export const deleteStaff = (id: string) => apiClient.delete(`/users/staff/${id}`);
