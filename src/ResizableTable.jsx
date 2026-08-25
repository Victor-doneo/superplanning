import { useCallback, useEffect, useRef, useState } from 'react'

// Table avec colonnes redimensionnables à la souris (glisser le bord droit
// d'un en-tête). Les largeurs sont mémorisées dans localStorage par clé de
// table, pour survivre aux rechargements.
export function useColumnWidths(storageKey, columns) {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return columns.map(c => saved[c.key] ?? c.width)
    } catch {
      return columns.map(c => c.width)
    }
  })

  const dragRef = useRef(null)

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return
      const { index, startX, startWidth } = dragRef.current
      const next = Math.max(40, startWidth + (e.clientX - startX))
      setWidths(w => {
        const copy = [...w]
        copy[index] = next
        return copy
      })
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      setWidths(w => {
        try {
          const obj = {}
          columns.forEach((c, i) => { obj[c.key] = w[i] })
          localStorage.setItem(storageKey, JSON.stringify(obj))
        } catch { /* ignore */ }
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [storageKey, columns])

  function startDrag(index, e) {
    dragRef.current = { index, startX: e.clientX, startWidth: widths[index] }
    e.preventDefault()
  }

  return { widths, startDrag }
}

export function ResizableTh({ children, index, width, onStartDrag, className = '' }) {
  return (
    <th className={className} style={{ width, position: 'relative' }}>
      {children}
      <span
        className="col-resize-handle"
        onMouseDown={e => onStartDrag(index, e)}
      />
    </th>
  )
}
