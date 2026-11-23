/**
 * 사진 줄이기: 폰 사진(수 MB)을 긴 변 1280px JPEG로 줄여 data URL로 만든다
 *   → Firestore 문서 한 개(최대 1MB)에 그대로 저장 (사진 전용 저장소 없이 무료 요금제 안에서)
 *   → 보통 장당 150~400KB. 폰 화면으로 보기엔 충분하고 원본 화질은 아님
 */

const MAX_SIDE = 1280
const MAX_DATA = 700_000 // data URL 글자 수 상한 (문서 한도 1MB 안쪽으로 여유 있게)

interface Loaded {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function load(file: File): Promise<Loaded> {
  // 사진 방향(EXIF)은 둘 다 알아서 맞춰 준다
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      /* 이 형식은 img 태그로 다시 시도 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('이 사진은 읽지 못했어요')
  }
}

export async function shrinkPhoto(file: File): Promise<{ data: string; width: number; height: number }> {
  const img = await load(file)
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    let quality = 0.75
    for (let i = 0; i < 5; i++) {
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('사진을 줄이지 못했어요')
      ctx.fillStyle = '#ffffff' // 투명한 PNG는 흰 바탕으로
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img.source, 0, 0, width, height)
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length <= MAX_DATA) return { data, width, height }
      scale *= 0.8
      quality = Math.max(0.5, quality - 0.08)
    }
    throw new Error('사진이 너무 커서 줄이지 못했어요')
  } finally {
    img.release()
  }
}
