import { useEffect, useState } from 'react'

export default function useEntered() {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  return entered
}
