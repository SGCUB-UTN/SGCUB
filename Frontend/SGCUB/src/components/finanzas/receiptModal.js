export function receiptModalStyles(fullScreen = false, height = '90dvh') {
  return {
    content: { display: 'flex', flexDirection: 'column', height: fullScreen ? '100dvh' : height, overflow: 'hidden' },
    body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  }
}
