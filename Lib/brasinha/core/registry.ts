import {
  isBrasinhaOpenAiReady,
  resolveBrasinhaOpenAiModel,
} from '../env.ts'
import { createOpenAIReasoner } from './openaiReasoner.ts'
import { createDeterministicReasoner, type BrasinhaReasoner } from './reasoner.ts'

export function resolveBrasinhaReasoner(
  source: Record<string, string | undefined> = process.env,
): BrasinhaReasoner {
  if (!isBrasinhaOpenAiReady(source)) {
    return createDeterministicReasoner()
  }
  return createOpenAIReasoner({
    model: resolveBrasinhaOpenAiModel(source),
    fallback: createDeterministicReasoner(),
    env: source,
  })
}
