import { Card, Divider } from "tdesign-react";
import { LinkIcon, MailIcon, UserIcon } from "tdesign-icons-react";

export function Settings() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">设置</h2>

      <Card title="系统信息" bordered className="mb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-20">版本</span>
            <span className="font-mono">v1.0.0</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-20">PG 端口</span>
            <span className="font-mono">5408</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-20">REST 端口</span>
            <span className="font-mono">5000</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-20">存储引擎</span>
            <span>Apache Parquet + Arrow</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-20">加密</span>
            <span>TLS 1.3 + P-521 ECDHE + AES-256-GCM</span>
          </div>
        </div>
      </Card>

      <Card title="关于" bordered className="mb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <UserIcon className="text-purple-600" />
            <span className="text-gray-500 w-20">作者</span>
            <span>钟智强</span>
          </div>
          <div className="flex items-center gap-3">
            <MailIcon className="text-purple-600" />
            <span className="text-gray-500 w-20">邮箱</span>
            <span>ctkqiang@dingtalk.com</span>
          </div>
          <div className="flex items-center gap-3">
            <LinkIcon className="text-purple-600" />
            <span className="text-gray-500 w-20">仓库</span>
            <a href="https://gitcode.com/ctkqiang_sr/HunTianDB" className="text-blue-600 underline">
              gitcode.com/ctkqiang_sr/HunTianDB
            </a>
          </div>
        </div>
      </Card>

      <Card title="技术栈" bordered>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["后端", "Rust + Tokio + Axum"],
            ["前端", "React 18 + TDesign + TanStack"],
            ["存储", "Arrow 53 + Parquet 53"],
            ["安全", "rustls 0.23 + ring 0.17"],
            ["SQL 解析", "sqlparser 0.51"],
            ["测试", "Criterion + Proptest"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-gray-500">{label}:</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
