import { NextBasicClient } from './next-basic-client'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <NextBasicClient
      initialEndpoint={process.env.FIRELINE_ENDPOINT ?? process.env.NEXT_PUBLIC_FIRELINE_ENDPOINT ?? ''}
    />
  )
}
