import { Card, Row, Col, Tag, Loading } from "tdesign-react";
import {
  ChartLineIcon, ServerIcon, TimeIcon, CheckCircleIcon,
} from "tdesign-icons-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";

const mockThroughput = [
  { time: "14:00", eps: 850000 }, { time: "14:05", eps: 920000 },
  { time: "14:10", eps: 880000 }, { time: "14:15", eps: 950000 },
  { time: "14:20", eps: 1020000 }, { time: "14:25", eps: 980000 },
];

export function Dashboard() {
  const { data, isLoading } = useEvents();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">仪表板</h2>

      <Row gutter={[16, 16]} className="mb-6">
        {[
          { label: "事件总写入量", value: "1.2M", icon: <ServerIcon />, color: "text-purple-600" },
          { label: "写入吞吐", value: "980K/s", icon: <ChartLineIcon />, color: "text-green-600" },
          { label: "查询延迟 P95", value: "12ms", icon: <TimeIcon />, color: "text-blue-600" },
          { label: "系统健康", value: "正常", icon: <CheckCircleIcon />, color: "text-emerald-600" },
        ].map((stat, i) => (
          <Col key={i} span={6}>
            <Card bordered>
              <div className="flex items-center gap-4">
                <span className={`text-3xl ${stat.color}`}>{stat.icon}</span>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="写入吞吐量 (events/sec)" bordered>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockThroughput}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="eps" stroke="#9333EA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="最近事件" bordered>
            {isLoading ? (
              <Loading />
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {(data?.rows || []).slice(0, 8).map((row: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b">
                    <span className="text-gray-500">#{row.id || i}</span>
                    <Tag size="small" theme="primary" variant="light">
                      {row.event_type || "事件"}
                    </Tag>
                  </div>
                ))}
                {(!data?.rows || data.rows.length === 0) && (
                  <p className="text-gray-400 text-center py-8">暂无事件数据</p>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
