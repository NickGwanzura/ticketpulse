interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export default function QrCode({ value, size = 160, className }: QrCodeProps) {
  const N = 25
  // Hash → bit array (0/1) for cells
  function bitFor(x: number, y: number): boolean {
    let h = 2166136261
    h = (h ^ x) >>> 0; h = Math.imul(h, 16777619)
    h = (h ^ y) >>> 0; h = Math.imul(h, 16777619)
    for (let i = 0; i < value.length; i++) {
      h = (h ^ value.charCodeAt(i)) >>> 0
      h = Math.imul(h, 16777619)
    }
    return ((h >>> (x % 16)) & 1) === 1
  }

  function isFinder(x: number, y: number): "outer" | "mid" | "inner" | null {
    const corners: [number, number][] = [
      [0, 0], [N - 7, 0], [0, N - 7],
    ]
    for (const [cx, cy] of corners) {
      if (x >= cx && x < cx + 7 && y >= cy && y < cy + 7) {
        const lx = x - cx, ly = y - cy
        const onOuter = lx === 0 || lx === 6 || ly === 0 || ly === 6
        const onInnerBox = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
        if (onInnerBox) return "inner"
        if (onOuter) return "outer"
        return "mid" // ring gap
      }
    }
    return null
  }

  function isQuiet(x: number, y: number) {
    const corners: [number, number][] = [
      [0, 0], [N - 7, 0], [0, N - 7],
    ]
    for (const [cx, cy] of corners) {
      if (x >= cx && x < cx + 8 && y >= cy && y < cy + 8) return true
    }
    return false
  }

  const cell = size / N
  const cells: React.ReactElement[] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const finder = isFinder(x, y)
      if (finder === "outer" || finder === "inner") {
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} className="fill-ink" />)
        continue
      }
      if (finder === "mid" || isQuiet(x, y)) continue
      if (bitFor(x, y)) {
        cells.push(<rect key={`${x}-${y}`} x={x * cell + cell * 0.08} y={y * cell + cell * 0.08} width={cell * 0.84} height={cell * 0.84} rx={cell * 0.18} className="fill-ink" />)
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-label={`QR code for ${value}`}>
      <rect width={size} height={size} className="fill-paper" rx={cell * 1.2} />
      {cells}
    </svg>
  )
}
