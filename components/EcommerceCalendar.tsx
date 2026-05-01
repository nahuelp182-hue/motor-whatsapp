'use client'

const EVENTS = [
  { name: 'Hot Sale', date: '2026-05-11', campaignStart: '2026-04-26', color: 'from-orange-500/20 to-orange-500/5' },
  { name: 'Día del Padre', date: '2026-06-21', campaignStart: '2026-06-06', color: 'from-blue-500/20 to-blue-500/5' },
  { name: 'CyberMonday', date: '2026-11-02', campaignStart: '2026-10-18', color: 'from-purple-500/20 to-purple-500/5' },
  { name: 'Navidad', date: '2026-12-25', campaignStart: '2026-12-10', color: 'from-green-500/20 to-green-500/5' },
]

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function EcommerceCalendar() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
        Calendario E-commerce AR
      </h3>
      <div className="space-y-3">
        {EVENTS.map((ev) => {
          const daysToEvent = daysUntil(ev.date)
          const daysToCampaign = daysUntil(ev.campaignStart)
          const shouldActivate = daysToCampaign <= 3 && daysToCampaign >= 0
          const isPast = daysToEvent < 0

          return (
            <div
              key={ev.name}
              className={`rounded-xl bg-gradient-to-r ${ev.color} border border-white/10 p-4 flex items-center justify-between`}
            >
              <div>
                <p className="font-semibold text-white">{ev.name}</p>
                <p className="text-xs text-white/50 mt-0.5">
                  Activar campaña: {ev.campaignStart}
                </p>
              </div>
              <div className="text-right">
                {isPast ? (
                  <span className="text-xs text-white/55">Pasado</span>
                ) : shouldActivate ? (
                  <span className="text-xs font-bold text-orange-400 animate-pulse">
                    ¡Activar ahora!
                  </span>
                ) : (
                  <span className="text-xs text-white/60">
                    en {daysToEvent}d
                  </span>
                )}
                <p className="text-xs text-white/55 mt-0.5">{ev.date}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
