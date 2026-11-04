export function receiptModalStyles(fullScreen = false) {
  return {
    content: { display: 'flex', flexDirection: 'column', height: fullScreen ? '100dvh' : '90dvh', overflow: 'hidden' },
    body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  }
}
