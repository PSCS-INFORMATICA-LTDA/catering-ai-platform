import MediaPage from '../MediaPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function MediaPackagesPage() {
  return <MediaPage initialView="packages" />
}
