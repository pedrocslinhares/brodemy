import { fmtNum } from '../lib/utils'

export interface ChartPoint {
  label: string
  value: number
}

const W = 340
const PAD = { l: 38, r: 12, t: 16, b: 26 }

function niceRange(values: number[]) {
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min = min - (Math.abs(min) * 0.1 || 1)
    max = max + (Math.abs(max) * 0.1 || 1)
  }
  const span = max - min
  min = Math.max(0, min - span * 0.1)
  max = max + span * 0.1
  return { min, max }
}

export function LineChart({ data, height = 190, color = 'var(--accent)', unit = '' }: {
  data: ChartPoint[]
  height?: number
  color?: string
  unit?: string
}) {
  if (!data.length) return <div className="chart-empty muted small">Sem dados para este indicador.</div>
  const H = height
  const { min, max } = niceRange(data.map((d) => d.value))
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min)) * ih
  const ticks = [min, min + (max - min) / 2, max]
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1).toFixed(1)},${PAD.t + ih} L${x(0).toFixed(1)},${PAD.t + ih} Z`
  const labelIdx = data.length <= 2 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1]
  const last = data[data.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">
            {fmtNum(t, t < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={data.length > 30 ? 2 : 3.5} fill={color} />
      ))}
      <text
        x={Math.min(x(data.length - 1), W - PAD.r)}
        y={y(last.value) - 9}
        textAnchor="end"
        className="chart-value"
      >
        {fmtNum(last.value, 1)}
        {unit}
      </text>
      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor={data.length === 1 ? 'middle' : i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
          className="chart-tick"
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  )
}

export function BarChart({ data, height = 150, color = 'var(--accent)' }: {
  data: ChartPoint[]
  height?: number
  color?: string
}) {
  const H = height
  const max = Math.max(1, ...data.map((d) => d.value))
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const bw = iw / Math.max(1, data.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} className="chart-grid" />
      <text x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" className="chart-tick">
        {max}
      </text>
      {data.map((d, i) => {
        const h = (d.value / max) * ih
        return (
          <g key={i}>
            <rect
              x={PAD.l + i * bw + bw * 0.18}
              y={PAD.t + ih - h}
              width={bw * 0.64}
              height={Math.max(h, d.value ? 2 : 0)}
              rx={3}
              fill={color}
              opacity={i === data.length - 1 ? 1 : 0.55}
            />
            {(i % 2 === data.length % 2 || data.length <= 8) && (
              <text x={PAD.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="chart-tick">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
