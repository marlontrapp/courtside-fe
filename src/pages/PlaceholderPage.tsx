import { PageHeader } from '@/components/PageHeader'

type PlaceholderPageProps = {
  title: string
  lead: string
}

export function PlaceholderPage({ title, lead }: PlaceholderPageProps) {
  return <PageHeader eyebrow="Coming soon" title={title} description={lead} />
}
