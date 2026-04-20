import { createFlamecastIntentFromEnv, renderSummary } from './framework-boundary.js'
import { runFlamecastCharacterization } from './fireline-adapter.js'

const summary = await runFlamecastCharacterization(createFlamecastIntentFromEnv(process.env))
console.log(renderSummary(summary))
