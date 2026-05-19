import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("huntiandb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 → 清除token并跳转登录
    if (err.response?.status === 401) {
      localStorage.removeItem("huntiandb_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    // 网络错误 → 更友好的消息
    if (!err.response) {
      err.message = "无法连接到混天DB后端 (localhost:5000)";
    }
    return Promise.reject(err);
  }
);

export default api;
