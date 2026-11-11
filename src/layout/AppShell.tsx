import { useEffect, useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { logout } from '@/api/auth'
import { useAuth } from '@/auth/auth-context'
import { APP_NAV } from '@/layout/nav'

export function AppShell() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const titleId = useId()

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      setMenuOpen(false)
      await refresh()
      navigate('/login', { replace: true })
    },
  })

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="relative min-h-dvh bg-ink text-line">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(31,122,85,0.28),transparent_55%),linear-gradient(180deg,#07150f,#0c3b2a)]"
      />
      <div aria-hidden className="court-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative flex min-h-dvh">
        {menuOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-ink/70 md:hidden"
            onClick={closeMenu}
          />
        ) : null}

        <aside
          id="app-side-nav"
          aria-labelledby={titleId}
          className={[
            'fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col border-r border-line/15 bg-ink/95 backdrop-blur-sm transition-transform duration-300 ease-out md:static md:z-0 md:w-64 md:translate-x-0 md:bg-ink/40',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-5">
            <div>
              <p id={titleId} className="text-xs font-medium tracking-[0.28em] text-ball uppercase">
                CourtControl
              </p>
              <p className="mt-1 text-sm text-fog">Find your way around</p>
            </div>
            <button
              type="button"
              className="border border-line/20 px-2.5 py-1.5 text-xs tracking-wide text-mist uppercase transition hover:border-ball hover:text-ball md:hidden"
              onClick={closeMenu}
            >
              Close
            </button>
          </div>

          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 py-4">
            {APP_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeMenu}
                className={({ isActive }) =>
                  [
                    'group block border-l-2 px-3 py-3 transition',
                    isActive
                      ? 'border-ball bg-ball/10 text-line'
                      : 'border-transparent text-mist hover:border-line/40 hover:bg-line/5 hover:text-line',
                  ].join(' ')
                }
              >
                <span className="block text-sm font-medium tracking-wide uppercase">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-fog group-hover:text-mist">
                  {item.description}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-line/10 px-5 py-5">
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full border border-line/30 px-4 py-2.5 text-sm font-medium tracking-wide text-line uppercase transition hover:border-ball hover:text-ball disabled:opacity-60"
            >
              {mutation.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line/10 bg-ink/80 px-4 py-3 backdrop-blur-sm md:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="app-side-nav"
              className="border border-line/20 px-3 py-2 text-xs font-medium tracking-wide text-line uppercase transition hover:border-ball hover:text-ball"
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </button>
            <p className="text-xs font-medium tracking-[0.24em] text-ball uppercase">
              CourtControl
            </p>
          </header>

          <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
