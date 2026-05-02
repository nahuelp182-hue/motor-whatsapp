'use client'
import { useId } from 'react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

export function SparklineChart({ data, color }: { data: number[]; color?: string }) {
  const uid   = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradId = `sg-${uid}`
  const strokeColor = color ?? 'rgb(var(--ac))'
  const chartData   = data.map((v, i) => ({ i, v }))

  return (
    <div style={{ width: '100%', height: '100%', color: strokeColor }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   style={{ stopColor: 'currentColor', stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: 'currentColor', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="v"
            stroke="currentColor" strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
