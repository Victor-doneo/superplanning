function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function defaultRange() {
  const t = todayISO()
  return { from: t, to: t }
}

export default function DateRangePicker({ from, to, onChange }) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        className="form-input"
        value={from}
        max={to}
        onChange={e => onChange({ from: e.target.value, to })}
      />
      <span className="text-sm text-gray">→</span>
      <input
        type="date"
        className="form-input"
        value={to}
        min={from}
        onChange={e => onChange({ from, to: e.target.value })}
      />
      <button className="btn" onClick={() => onChange(defaultRange())}>Aujourd'hui</button>
    </div>
  )
}
