/** The lit-court background of the full-screen pages (sign in, choosing how to continue). */
export function CourtBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="fade-in absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(31,122,85,0.45),transparent_55%),radial-gradient(ellipse_at_80%_10%,rgba(200,245,66,0.12),transparent_40%),linear-gradient(160deg,#07150f_0%,#0c3b2a_48%,#07150f_100%)]"
      />
      <div aria-hidden className="court-grid absolute inset-0 opacity-40" />
      <div
        aria-hidden
        className="pulse-line absolute left-[12%] top-[18%] h-[64%] w-px bg-gradient-to-b from-transparent via-line/70 to-transparent"
      />
      <div
        aria-hidden
        className="pulse-line absolute left-[12%] right-[18%] top-[50%] h-px bg-gradient-to-r from-transparent via-ball/70 to-transparent [animation-delay:400ms]"
      />
    </>
  )
}
