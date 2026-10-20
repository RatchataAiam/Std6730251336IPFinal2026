import { Platform } from 'react-native';

export type Employee = {
  id: string;
  name: string;
  position: string;
  status: 'Active' | 'On Leave';
  salary: number;
};

export type SalaryCluster = {
  group: string;
  centroid: number;
  count: number;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3099' : 'http://localhost:3099');

async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  login: (username: string, password: string) => request<{ success: true; token: string }>('/api/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  employees: (token: string) => request<{ success: true; employees: Employee[] }>('/api/employees', token),
  addEmployee: (token: string, employee: Pick<Employee, 'name' | 'position' | 'salary'>) =>
    request<{ success: true; employee: Employee }>('/api/employees', token, {
      method: 'POST',
      body: JSON.stringify(employee),
    }),
  toggleStatus: (token: string, id: string) =>
    request<{ success: true; employee: Employee }>(`/api/employees/${encodeURIComponent(id)}/status`, token, {
      method: 'PUT',
    }),
  deleteEmployee: (token: string, id: string) =>
    request<{ success: true }>(`/api/employees/${encodeURIComponent(id)}`, token, { method: 'DELETE' }),
  salaryClusters: (token: string) =>
    request<{ success: true; clusters: SalaryCluster[] }>('/api/employees/salary-clusters', token),
};