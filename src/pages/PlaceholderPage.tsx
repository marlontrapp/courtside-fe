type PlaceholderPageProps = {
  title: string
  lead: string
}

export function PlaceholderPage({ title, lead }: PlaceholderPageProps) {
  return (
    <div className="fade-up mx-auto w-full max-w-3xl">
      <p className="mb-4 text-sm font-medium tracking-[0.28em] text-ball uppercase">
        Coming soon
      </p>
      <h1 className="font-display text-4xl tracking-tight text-line sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-mist">{lead}</p>
    </div>
  )
}
