import { useEffect, useState, type ReactNode } from 'react'
import { googleDirectionsUrl, googlePlaceUrl, hasCoords } from '../../lib/geo'
import { googlePlaceInfo, useGoogleEnabled, type PlaceInfo } from '../../lib/google'
import { fmtDay, mondayIndex } from '../../lib/util'
import type { Plan } from '../../types'
import { Sheet } from '../ui'

interface Props {
  plan: Plan
  number: number
  color: { bg: string; ink: string }
  dayLabel: string // 'DAY 1 · 12/5(토)'
  onEdit: () => void
  onClose: () => void
}

const btnLine = 'flex-1 rounded-xl border border-neutral-200 py-3 text-center text-[15px] font-medium text-neutral-700 active:bg-neutral-50'

/** 장소 상세: 구글 장소면 사진·평점·영업시간까지, 아니면 기본 정보 + 구글맵 버튼 */
export function DetailSheet({ plan, number, color, dayLabel, onEdit, onClose }: Props) {
  const google = useGoogleEnabled()
  const [info, setInfo] = useState<PlaceInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [allHours, setAllHours] = useState(false)

  useEffect(() => {
    if (!google || !plan.placeId) return
    let alive = true
    setLoading(true)
    googlePlaceInfo(plan.placeId)
      .then((i) => alive && setInfo(i))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [plan.placeId, google])

  const placeUrl = googlePlaceUrl(plan)
  const dirUrl = googleDirectionsUrl(plan)
  // 영업시간은 "그 일정 날짜"의 요일 기준 (날짜 미정이면 오늘)
  const dayIdx = mondayIndex(plan.date)
  const hoursLine = info?.hours[dayIdx]

  return (
    <Sheet
      title={plan.title}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {placeUrl && (
            <a href={placeUrl} target="_blank" rel="noopener noreferrer" className={btnLine}>
              구글맵
            </a>
          )}
          <button type="button" onClick={onEdit} className={btnLine}>
            수정
          </button>
          {dirUrl && (
            <a
              href={dirUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl bg-neutral-900 py-3 text-center text-[15px] font-semibold text-white active:bg-neutral-700"
            >
              길찾기
            </a>
          )}
        </div>
      }
    >
      {loading && !info && <div className="h-44 animate-pulse rounded-xl bg-neutral-100" />}
      {info?.photoUrl && (
        <figure>
          <img src={info.photoUrl} alt={plan.title} className="h-48 w-full rounded-xl object-cover" />
          {info.photoBy && (
            <figcaption className="mt-1 text-right text-[11px] text-neutral-400">
              사진{' '}
              {info.photoBy.uri ? (
                <a href={info.photoBy.uri} target="_blank" rel="noopener noreferrer" className="underline">
                  {info.photoBy.name}
                </a>
              ) : (
                info.photoBy.name
              )}
            </figcaption>
          )}
        </figure>
      )}

      <div className="flex items-center gap-2.5">
        {number > 0 && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={hasCoords(plan) ? { background: color.bg, color: color.ink } : { background: '#e5e5e5', color: '#737373' }}
          >
            {number}
          </span>
        )}
        <p className="text-[13px] text-neutral-500">{[dayLabel || fmtDay(plan.date), plan.time].filter(Boolean).join(' · ')}</p>
      </div>

      {(plan.kind || plan.area || info?.rating != null) && (
        <p className="-mt-2 text-sm text-neutral-600">
          {info?.rating != null && (
            <span className="mr-2 font-semibold text-neutral-900">
              ★ {info.rating.toFixed(1)}
              {info.ratingCount != null && <span className="ml-1 font-normal text-neutral-400">({info.ratingCount.toLocaleString('ko-KR')})</span>}
            </span>
          )}
          {[plan.kind, plan.area].filter(Boolean).join(' · ')}
        </p>
      )}

      {plan.memo && <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-700">{plan.memo}</p>}

      {info && (
        <ul className="space-y-2.5 text-sm text-neutral-700">
          {hoursLine && (
            <Row icon="🕘">
              <button type="button" onClick={() => setAllHours((v) => !v)} className="text-left">
                {hoursLine} <span className="text-xs text-neutral-400">{allHours ? '접기' : '요일별 보기'}</span>
              </button>
              {allHours && (
                <ul className="mt-1.5 space-y-0.5 text-[13px] text-neutral-500">
                  {info.hours.map((h, i) => (
                    <li key={h} className={i === dayIdx ? 'font-semibold text-neutral-800' : ''}>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          )}
          {info.address && <Row icon="📍">{info.address}</Row>}
          {info.phone && (
            <Row icon="📞">
              <a href={`tel:${info.phone.replace(/\s/g, '')}`} className="underline underline-offset-2">
                {info.phone}
              </a>
            </Row>
          )}
          {info.website && (
            <Row icon="🔗">
              <a href={info.website} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
                {info.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </Row>
          )}
        </ul>
      )}

      {google && !plan.placeId && (
        <p className="text-xs leading-relaxed text-neutral-400">수정 → 장소 변경에서 구글로 다시 검색해 넣으면 사진·평점·영업시간이 나와요.</p>
      )}
      {info && <p className="text-right text-[11px] text-neutral-400">Google Maps</p>}
    </Sheet>
  )
}

function Row({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="w-5 shrink-0 text-center" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}
