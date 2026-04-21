import { runInlineFireline } from '../../shared/run-inline-fireline'

export async function runInlineLaunch(options: {
  readonly endpoint: string
  readonly prompt: string
  readonly example: string
}) {
  const result = await runInlineFireline({
    endpoint: options.endpoint,
    prompt: options.prompt,
    example: options.example,
    responsePrefix: 'OpenNext-shaped agent heard: ',
  })
  return {
    example: options.example,
    ...result,
  }
}
